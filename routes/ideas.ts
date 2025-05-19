import { Hono } from "hono";
import { env } from "hono/adapter";
import "zod-openapi/extend";
import { z } from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { s3, sql } from "../db.ts";
import { error404, error500, json200, resp200 } from "./error.ts";

const app = new Hono();

const id_param = {
	id: {
		name: "id",
		in: "path",
		required: true,
		description: "Idea ID",
		schema: resolver(z.number()),
		example: 1,
	},
};

const id_tag_param = {
	id: {
		name: "id",
		in: "path",
		required: true,
		description: "Idea ID",
		schema: resolver(z.number()),
		example: 1,
	},
	tag: {
		name: "tag",
		in: "path",
		required: true,
		description: "Tag name",
		schema: resolver(z.string()),
		example: "tag1",
	},
};

const file_content = {
	"multipart/form-data": {
		schema: resolver(
			z.object({
				file: z.any().openapi({
					description: "File content",
					type: "string",
					format: "binary",
				}),
			}),
		),
	},
};

const sort_by = z.string().openapi({
	title: "Sort by",
	example: "upvotes",
	examples: ["upvotes", "downvotes", "title"],
}).optional();

const filter = z.string().openapi({
	title: "Filter by tags",
	example: "tag1",
	examples: ["tag1", "tag2", "tag3"],
}).optional();

const access = z.string().openapi({
	title: "Idea Access",
	example: "public",
	examples: ["public", "private:user_id", "group:group_id"],
}).optional();

const query_params = [
	{
		name: "sort_by",
		in: "query",
		required: false,
		description: "Sort by",
		schema: resolver(sort_by),
	},
	{
		name: "filter",
		in: "query",
		required: false,
		description: "Filter by tags",
		schema: resolver(filter),
	},
	{
		name: "access",
		in: "query",
		required: false,
		description: "Idea Access",
		schema: resolver(access),
	},
];

const ideasSchema = z.object({
	id: z.number().optional().openapi({
		title: "ID",
		example: 1,
	}),
	title: z.string().openapi({
		title: "Title",
		example: "Idea Title",
	}),
	content: z.string().openapi({
		title: "Content",
		example: "Idea Content",
	}),
	user_id: z.string().openapi({
		title: "User ID",
		example: "1",
	}),
	files_url: z.array(z.string().url()).openapi({
		title: "Files URL",
		example: [
			"https://example.com/file1.jpg",
			"https://example.com/file2.jpg",
		],
	}),
	access: z.string().openapi({
		title: "Access",
		example: "public",
	}),
	upvotes: z.number().openapi({
		title: "Upvotes",
		example: 10,
	}),
	downvotes: z.number().openapi({
		title: "Downvotes",
		example: 5,
	}),
});

const ideasSchemaWithTags = z.object({
	id: z.number().optional().openapi({
		title: "ID",
		example: 1,
	}),
	title: z.string().openapi({
		title: "Title",
		example: "Idea Title",
	}),
	content: z.string().openapi({
		title: "Content",
		example: "Idea Content",
	}),
	user_id: z.string().openapi({
		title: "User ID",
		example: "1",
	}),
	files_url: z.array(z.string().url()).openapi({
		title: "Files URL",
		example: [
			"https://example.com/file1.jpg",
			"https://example.com/file2.jpg",
		],
	}),
	access: z.string().openapi({
		title: "Access",
		example: "public",
	}),
	upvotes: z.number().openapi({
		title: "Upvotes",
		example: 10,
	}),
	downvotes: z.number().openapi({
		title: "Downvotes",
		example: 5,
	}),
	tags: z.array(z.string()).openapi({
		title: "Tags",
		example: ["tag1", "tag2"],
	}),
});

app.get(
	"/ideas",
	describeRoute({
		method: "get",
		path: "/ideas",
		tags: ["ideas"],
		description: "Get all ideas",
		parameters: query_params,
		responses: {
			200: json200(z.array(ideasSchemaWithTags)),
			500: error500,
		},
	}),
	zValidator(
		"query",
		z.object({
			sort_by,
			filter,
			access,
		}),
	),
	async (c) => {
		const { sort_by, filter, access } = c.req.valid("query");
		const sort_by_sql = sort_by ? sql`ORDER BY i.${sort_by}` : sql``;
		const filter_sql = filter ? sql`WHERE t.name = ${filter}` : sql``;
		const access_sql =
			(access?.startsWith("private:") || access?.startsWith("group:"))
				? filter
					? sql`AND (i.access = ${access} OR i.access = 'public')`
					: sql`WHERE (i.access = ${access} OR i.access = 'public')`
				: sql``;

		const rows = await sql`SELECT 
			i.id,
			i.title,
			i.content,
			i.user_id,
			COALESCE(
				ARRAY_AGG(t.name),
				ARRAY[]::VARCHAR[]
			) AS tags,
			i.files_url,
			i.access,
			i.upvotes,
			i.downvotes
			FROM ideas i
			LEFT JOIN ideas_tags it ON i.id = it.idea_id
			LEFT JOIN tags t ON it.tag_id = t.id
			${filter_sql}
			${access_sql}
			GROUP BY i.id, i.title, i.content, i.user_id, i.files_url, i.access, i.upvotes, i.downvotes
			${sort_by_sql};
		`;

		return c.json(rows);
	},
);

app.post(
	"/ideas",
	describeRoute({
		method: "post",
		path: "/ideas",
		tags: ["ideas"],
		description: "Create a new idea",
		content: {
			"application/json": {
				schema: resolver(ideasSchemaWithTags),
			},
		},
		responses: {
			201: json200(ideasSchemaWithTags),
			400: error404,
			500: error500,
		},
	}),
	zValidator("json", ideasSchemaWithTags),
	async (c) => {
		const { title, content, user_id, files_url, access, tags } = c.req
			.valid("json");

		const tags_obj = tags.map((tag) => ({ name: tag }));
		await sql`INSERT INTO tags ${
			sql(tags_obj)
		} ON CONFLICT (name) DO NOTHING`;
		const rows1 = await sql`SELECT id FROM tags WHERE name IN ${sql(tags)}`;

		const rows2 =
			await sql`INSERT INTO ideas (title, content, user_id, files_url, access) 
		VALUES (${title}, ${content}, ${user_id}, ${files_url}, ${access}) RETURNING *`;

		if (!rows2[0]?.id) {
			throw new HTTPException(400, { message: "Failed to create idea" });
		}
		const tagIds = rows1.map((row) => ({
			idea_id: rows2[0]?.id,
			tag_id: row?.id as number,
		}));
		await sql`INSERT INTO ideas_tags ${sql(tagIds)}`;
		rows2[0].tags = tags;
		return c.json(rows2[0]);
	},
);

app.get(
	"/ideas/:id",
	describeRoute({
		method: "get",
		path: "/ideas/:id",
		tags: ["ideas"],
		description: "Get an idea by ID",
		parameter: id_param,
		responses: {
			200: json200(z.array(ideasSchemaWithTags)),
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number() })),
	async (c) => {
		const { id } = c.req.valid("param");
		const rows = await sql`SELECT 
		i.id,
		i.title,
		i.content,
		i.user_id,
		COALESCE(
			ARRAY_AGG(t.name),
			ARRAY[]::VARCHAR[]
		) AS tags,
		i.files_url,
		i.access,
		i.upvotes,
		i.downvotes
		FROM ideas i
		LEFT JOIN ideas_tags it ON i.id = it.idea_id
		LEFT JOIN tags t ON it.tag_id = t.id
		WHERE i.id = ${id}
		GROUP BY i.id, i.title, i.content, i.user_id, i.files_url, i.access, i.upvotes, i.downvotes;`;
		return c.json(rows[0]);
	},
);

app.delete(
	"/ideas/:id",
	describeRoute({
		method: "delete",
		path: "/ideas/:id",
		tags: ["ideas"],
		description: "Delete an idea",
		parameter: id_param,
		responses: {
			200: json200(ideasSchemaWithTags),
			404: error404,
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number() })),
	async (c) => {
		const { id } = c.req.valid("param");
		const rows = await sql`DELETE FROM ideas WHERE id = ${id} RETURNING *`;
		return c.json(rows[0]);
	},
);

app.post(
	"/ideas/up/:id",
	describeRoute({
		method: "post",
		path: "/ideas/up/:id",
		tags: ["ideas"],
		description: "Vote on an idea",
		parameter: id_param,
		responses: {
			200: json200(ideasSchemaWithTags),
			404: error404,
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number() })),
	async (c) => {
		const { id } = c.req.valid("param");
		const rows =
			await sql`UPDATE ideas SET upvotes = upvotes + 1 WHERE id = ${id} RETURNING *`;
		return c.json(rows[0]);
	},
);

app.post(
	"/ideas/down/:id",
	describeRoute({
		method: "post",
		path: "/ideas/down/:id",
		tags: ["ideas"],
		description: "Vote on an idea",
		parameter: id_param,
		responses: {
			200: json200(ideasSchemaWithTags),
			404: error404,
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number() })),
	async (c) => {
		const { id } = c.req.valid("param");
		const rows =
			await sql`UPDATE ideas SET downvotes = downvotes + 1 WHERE id = ${id} RETURNING *`;
		return c.json(rows[0]);
	},
);

app.delete(
	"/ideas/up/:id",
	describeRoute({
		method: "delete",
		path: "/ideas/up/:id",
		tags: ["ideas"],
		description: "Vote on an idea",
		parameter: id_param,
		responses: {
			200: json200(ideasSchemaWithTags),
			404: error404,
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number() })),
	async (c) => {
		const { id } = c.req.valid("param");
		const rows =
			await sql`UPDATE ideas SET upvotes = upvotes - 1 WHERE id = ${id} RETURNING *`;
		return c.json(rows[0]);
	},
);

app.delete(
	"/ideas/down/:id",
	describeRoute({
		method: "delete",
		path: "/ideas/down/:id",
		tags: ["ideas"],
		description: "Vote on an idea",
		parameter: id_param,
		responses: {
			200: json200(ideasSchemaWithTags),
			404: error404,
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number() })),
	async (c) => {
		const { id } = c.req.valid("param");
		const rows =
			await sql`UPDATE ideas SET downvotes = downvotes - 1 WHERE id = ${id} RETURNING *`;
		return c.json(rows[0]);
	},
);

app.get("/ideas/user/:user_id", describeRoute({
    method: "get",
    path: "/ideas/user/:user_id",
    tags: ["ideas"],
    description: "Get ideas by user ID",
    parameter: id_param,
    responses: {
        200: json200(z.array(ideasSchemaWithTags)),
        500: error500,
    },
}), zValidator("param", z.object({ user_id: z.string() })), async (c) => {
    const { user_id } = c.req.valid("param");
    const rows = await sql`SELECT * FROM ideas WHERE user_id = ${user_id} ORDER BY created_at DESC`;
    return c.json(rows);
})

app.post(
	"/ideas/file/:id",
	describeRoute({
		method: "post",
		path: "/ideas/file/:id",
		tags: ["ideas"],
		description: "Add a file to an idea",
		parameter: id_param,
		content: file_content,
		responses: {
			200: json200(ideasSchemaWithTags),
			404: error404,
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number() })),
	async (c) => {
		const { id } = c.req.valid("param");
		const body = await c.req.parseBody();
		const file = body.file as File;
		const { AWS_BUCKET_NAME } = env<{ AWS_BUCKET_NAME: string }>(c);
		const file_name = `${id}/${file.name}`;
		const file_url =
			`https://${AWS_BUCKET_NAME}.fly.storage.tigris.dev/${file_name}`;

		const s3file = s3.file(file_name);
		await s3file.write(await file.arrayBuffer());
		const rows =
			await sql`UPDATE ideas SET files_url = array_append(files_url, ${file_url}) WHERE id = ${id} RETURNING *`;
		return c.json(rows[0]);
	},
);

app.delete(
	"/ideas/file/:id",
	describeRoute({
		method: "delete",
		path: "/ideas/file/:id",
		tags: ["ideas"],
		description: "Remove a file from an idea",
		parameter: id_param,
		responses: {
			200: json200(ideasSchemaWithTags),
			404: error404,
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number() })),
	async (c) => {
		const { id } = c.req.valid("param");
		const body = await c.req.parseBody();
		const file = body.file as File;
		const { AWS_BUCKET_NAME } = env<{ AWS_BUCKET_NAME: string }>(c);
		const file_name = `${id}/${file.name}`;
		const file_url =
			`https://${AWS_BUCKET_NAME}.fly.storage.tigris.dev/${file_name}`;

		const s3file = s3.file(file_name);
		await s3file.delete();
		const rows =
			await sql`UPDATE ideas SET files_url = array_remove(files_url, ${file_url}) WHERE id = ${id} RETURNING *`;
		return c.json(rows[0]);
	},
);

app.post(
	"/ideas/:id/:tag",
	describeRoute({
		method: "post",
		path: "/ideas/:id/:tag",
		tags: ["ideas"],
		description: "Add a tag to an idea",
		parameter: id_tag_param,
		responses: {
			200: resp200,
			404: error404,
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number(), tag: z.string() })),
	async (c) => {
		const { id, tag } = c.req.valid("param");
		await sql`INSERT INTO ideas_tags VALUES (${id}, (SELECT id FROM tags WHERE name = ${tag} )) RETURNING *`;
		return c.body(null, 200);
	},
);

app.delete(
	"/ideas/tag/:id",
	describeRoute({
		method: "delete",
		path: "/ideas/tag/:id",
		tags: ["ideas"],
		description: "Remove a tag from an idea",
		parameter: id_tag_param,
		responses: {
			200: resp200,
			404: error404,
			500: error500,
		},
	}),
	zValidator("param", z.object({ id: z.number(), tag: z.string() })),
	async (c) => {
		const { id, tag } = c.req.valid("param");
		await sql`DELETE FROM ideas_tags WHERE idea_id = ${id} AND tag_id = (SELECT id FROM tags WHERE name = ${tag})`;
		return c.body(null, 200);
	},
);

export default app;
