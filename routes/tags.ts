import { Hono } from "hono";
import "zod-openapi/extend";
import { z } from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { sql } from "../db.ts";
import { error404, error500, json200, resp200 } from "./error.ts";

const app = new Hono();

const tagsSchema = z.array(z.string()).openapi({
  example: ["tag1", "tag2", "tag3"],
});

const tagSchema = z.object({
  id: z.number().openapi({
    title: "Tag ID",
    example: 1,
  }),
  name: z.string().openapi({
    title: "Tag name",
    example: "tag1",
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

const name_param = {
  name: {
    name: "name",
    in: "path",
    required: true,
    description: "Tag name",
    schema: resolver(z.string()),
    example: "tag1",
  },
};

app.get(
  "/tags",
  describeRoute({
    method: "get",
    path: "/tags",
    tags: ["tags"],
    description: "Get all tags",
    responses: {
      200: json200(tagsSchema),
      500: error500,
    },
  }),
  async (c) => {
    const rows = await sql`SELECT name FROM tags`;
    return c.json(rows);
  },
);

app.get(
  "/tags/:name",
  describeRoute({
    method: "get",
    path: "/tags/:name",
    tags: ["tags"],
    description: "Get a tag by name",
    parameter: name_param,
    responses: {
      200: json200(tagSchema),
      500: error500,
    },
  }),
  zValidator("param", z.object({ name: z.string() })),
  async (c) => {
    const { name } = c.req.valid("param");
    const rows = await sql`SELECT * FROM tags WHERE name = ${name}`;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "Tag not found" });
    }
    return c.json(rows[0]);
  },
);

app.post(
  "/tags/up/:name",
  describeRoute({
    method: "post",
    path: "/tags/up/:name",
    tags: ["tags"],
    description: "Increase the upvotes of a tag",
    parameter: name_param,
    responses: {
      200: resp200,
      404: error404,
      500: error500,
    },
  }),
  zValidator("param", z.object({ name: z.string() })),
  async (c) => {
    const { name } = c.req.valid("param");
    const rows = await sql`UPDATE tags SET upvotes = upvotes + 1 WHERE name = ${name} RETURNING *`;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "Tag not found" });
    }
    return c.body(null, 200);
  },
);

app.post(
  "/tags/down/:name",
  describeRoute({
    method: "post",
    path: "/tags/down/:name",
    tags: ["tags"],
    description: "Increase the downvotes of a tag",
    parameter: name_param,
    responses: {
      200: resp200,
      404: error404,
      500: error500,
    },
  }),
  zValidator("param", z.object({ name: z.string() })),
  async (c) => {
    const { name } = c.req.valid("param");
    const rows = await sql`UPDATE tags SET downvotes = downvotes + 1 WHERE name = ${name} RETURNING *`;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "Tag not found" });
    }
    return c.body(null, 200);
  },
);

app.delete(
  "/tags/up/:name",
  describeRoute({
    method: "delete",
    path: "/tags/up/:name",
    tags: ["tags"],
    description: "Decrease the upvotes of a tag",
    parameter: name_param,
    responses: {
      200: resp200,
      404: error404,
      500: error500,
    },
  }),
  zValidator("param", z.object({ name: z.string() })),
  async (c) => {
    const { name } = c.req.valid("param");
    const rows = await sql`UPDATE tags SET upvotes = upvotes - 1 WHERE name = ${name} RETURNING *`;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "Tag not found" });
    }
    return c.body(null, 200);
  },
);

app.delete(
  "/tags/down/:name",
  describeRoute({
    method: "delete",
    path: "/tags/down/:name",
    tags: ["tags"],
    description: "Decrease the downvotes of a tag",
    parameter: name_param,
    responses: {
      200: resp200,
      404: error404,
      500: error500,
    },
  }),
  zValidator("param", z.object({ name: z.string() })),
  async (c) => {
    const { name } = c.req.valid("param");
    const rows = await sql`UPDATE tags SET downvotes = downvotes - 1 WHERE name = ${name} RETURNING *`;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "Tag not found" });
    }
    return c.body(null, 200);
  },
);

export default app;
