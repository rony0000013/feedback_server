import { Hono } from "hono";
import "zod-openapi/extend";
import { z } from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import sql from "../db.ts";
import { error404, error500, json200, resp200 } from "./error.ts";

const app = new Hono();

const ideasSchema = z.object({
  id: z.number().openapi({
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
    example: ["https://example.com/file1.jpg", "https://example.com/file2.jpg"],
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
  id: z.number().openapi({
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
    example: ["https://example.com/file1.jpg", "https://example.com/file2.jpg"],
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
    responses: {
      200: json200(z.array(ideasSchemaWithTags)),
      500: error500,
    },
  }),
  async (c) => {
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
    GROUP BY i.id, i.title, i.content, i.user_id, i.files_url, i.access, i.upvotes, i.downvotes;
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
    const { id, title, content, user_id, files_url, access, tags } = c.req
      .valid("json");

    await sql`INSERT OR IGNORE INTO tags (name) SELECT ${ sql(tags)}`;
    const rows1 = await sql`SELECT id FROM tags WHERE name IN (${ sql(tags) })`;
    const tagIds = rows1.map((row) => row?.id as number);

    await sql`INSERT INTO ideas (id, title, content, user_id, files_url, access) 
      VALUES (${id}, ${title}, ${content}, ${user_id}, ${files_url}, ${access}) RETURNING *`;
    await sql`INSERT INTO ideas_tags (idea_id, tag_id) ${ sql(tagIds.map((tagId) => [id, tagId])) }`;
    return c.json(ideasSchemaWithTags);
  },
);

export default app;
