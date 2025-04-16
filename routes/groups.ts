import { Hono } from "hono";
import { env } from "hono/adapter";
import "zod-openapi/extend";
import { z } from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { sql } from "../db.ts";
import { error404, error500, json200, resp200 } from "./error.ts";

const app = new Hono();

const id_param = {
    id: {
        name: "id",
        in: "path",
        required: true,
        description: "Group ID",
        schema: resolver(z.number()),
        example: 1,
    },
};

const id_tag_param = {
    id: {
        name: "id",
        in: "path",
        required: true,
        description: "Group ID",
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

const sort_by = z.string().openapi({
    title: "Sort by",
    example: "likes",
}).optional();

const groupsSchema = z.object({
    id: z.number().optional().openapi({
        title: "Group ID",
        example: 1,
    }),
    title: z.string().openapi({
        title: "Group title",
        example: "Group title",
    }),
    description: z.string().openapi({
        title: "Group description",
        example: "Group description",
    }),
    user_id: z.array(z.string()).openapi({
        title: "User IDs",
        example: ["1", "2", "3"],
    }),
    likes: z.number().default(0).openapi({
        title: "Likes",
        example: 10,
    }),
}).openapi({
    title: "Group",
    example: {
        id: 1,
        title: "Group title",
        description: "Group description",
        user_id: ["1", "2", "3"],
        likes: 10,
    },
});

app.get(
    "/groups",
    describeRoute({
        method: "get",
        path: "/groups",
        tags: ["groups"],
        description: "Get all groups",
        parameters: [sort_by],
        responses: {
            200: json200(groupsSchema),
            500: error500,
        },
    }),
    zValidator("query", z.object({ sort_by })),
    async (c) => {
        const { sort_by } = c.req.valid("query");
        const sort_by_sql = sort_by ? `ORDER BY ${sort_by}` : "";
        const rows = await sql`SELECT * FROM user_groups ${sort_by_sql}`;
        return c.json(rows);
    },
);

app.post(
    "/groups",
    describeRoute({
        method: "post",
        path: "/groups",
        tags: ["groups"],
        description: "Create a new group",
        content: {
            "application/json": {
                schema: resolver(groupsSchema),
            },
        },
        responses: {
            201: json200(groupsSchema),
            400: error404,
            500: error500,
        },
    }),
    zValidator("json", groupsSchema),
    async (c) => {
        const { title, description, user_id, likes } = c.req.valid("json");
        const rows =
            await sql`INSERT INTO user_groups (title, description, user_id, likes) 
            VALUES (${title}, ${description}, ${user_id}, ${likes}) RETURNING *`;
        return c.json(rows[0]);
    },
);

app.get(
    "/groups/:id",
    describeRoute({
        method: "get",
        path: "/groups/:id",
        tags: ["groups"],
        description: "Get a group by ID",
        parameter: id_param,
        responses: {
            200: json200(groupsSchema),
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    async (c) => {
        const { id } = c.req.valid("param");
        const rows = await sql`SELECT * FROM user_groups WHERE id = ${id}`;
        return c.json(rows[0]);
    },
);

app.put(
    "/groups/:id",
    describeRoute({
        method: "put",
        path: "/groups/:id",
        tags: ["groups"],
        description: "Update a group by ID",
        parameter: id_param,
        content: {
            "application/json": {
                schema: resolver(groupsSchema),
            },
        },
        responses: {
            200: json200(groupsSchema),
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    zValidator("json", groupsSchema),
    async (c) => {
        const { id } = c.req.valid("param");
        const { title, description, user_id, likes } = c.req.valid("json");
        const rows = await sql`UPDATE user_groups 
        SET title = ${title}, description = ${description}, user_id = ${user_id}, likes = ${likes} WHERE id = ${id} RETURNING *`;
        return c.json(rows[0]);
    },
);

app.delete(
    "/groups/:id",
    describeRoute({
        method: "delete",
        path: "/groups/:id",
        tags: ["groups"],
        description: "Delete a group by ID",
        parameter: id_param,
        responses: {
            200: resp200,
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    async (c) => {
        const { id } = c.req.valid("param");
        await sql`DELETE FROM user_groups WHERE id = ${id}`;
        return c.body(null, 200);
    },
);

app.post(
    "/groups/:id/:user_id",
    describeRoute({
        method: "post",
        path: "/groups/:id/:user_id",
        tags: ["groups"],
        description: "Add a user to a group by ID",
        parameter: id_tag_param,
        responses: {
            200: resp200,
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number(), user_id: z.string() })),
    async (c) => {
        const { id, user_id } = c.req.valid("param");
        await sql`UPDATE user_groups SET user_id = array_append(user_id, ${user_id}) WHERE id = ${id}`;
        return c.body(null, 200);
    },
);

app.delete(
    "/groups/:id/:user_id",
    describeRoute({
        method: "delete",
        path: "/groups/:id/:user_id",
        tags: ["groups"],
        description: "Remove a user from a group by ID",
        parameter: id_tag_param,
        responses: {
            200: resp200,
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number(), user_id: z.string() })),
    async (c) => {
        const { id, user_id } = c.req.valid("param");
        await sql`UPDATE user_groups SET user_id = array_remove(user_id, ${user_id}) WHERE id = ${id}`;
        return c.body(null, 200);
    },
);

export default app;
