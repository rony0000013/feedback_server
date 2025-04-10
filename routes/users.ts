import { Hono } from "hono";
import "zod-openapi/extend";
import { z } from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import sql from "../db.ts";
import { error404, error500, json200, resp200 } from "./error.ts";

const app = new Hono();

const userSchema = z.object({
  id: z.string().openapi({
    title: "User ID",
    example: "1",
  }),
  name: z.string().openapi({
    title: "Name",
    example: "John Doe",
  }),
  email: z.string().email().openapi({
    title: "Email",
    example: "john.doe@example.com",
  }),
  role: z.string().openapi({
    title: "Role",
    example: "admin",
  }),
  image_url: z.string().openapi({
    title: "Image URL",
    example: "https://example.com/john.doe.jpg",
  }),
});

const userSchemaWithPinnedTags = userSchema.extend({
  pinned_tags: z.array(z.string()).optional().openapi({
    title: "Pinned Tags",
    example: ["tag1", "tag2"],
  }),
});

const id_param = {
  id: {
    name: "id",
    in: "path",
    required: true,
    description: "User ID",
    schema: resolver(z.string()),
    example: "1",
  },
};

app.get(
  "/users",
  describeRoute({
    method: "get",
    path: "/users",
    tags: ["users"],
    description: "Get all users",
    responses: {
      200: json200(z.array(userSchemaWithPinnedTags)),
      500: error500,
    },
  }),
  async (c) => {
    const rows = await sql`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.role,
      u.image_url,
      COALESCE(
          ARRAY_AGG(t.name),
          ARRAY[]::VARCHAR[]
      ) AS pinned_tags
      FROM users u
      LEFT JOIN users_pinned_tags upt ON u.id = upt.user_id
      LEFT JOIN tags t ON upt.tag_id = t.id
      GROUP BY u.id, u.name, u.email, u.role, u.image_url;
      `;

    return c.json(rows);
  },
);

app.post(
  "/users",
  describeRoute({
    method: "post",
    path: "/users",
    tags: ["users"],
    description: "Create a new user",
    content: {
      "application/json": {
        schema: resolver(userSchema),
      },
    },
    responses: {
      201: json200(userSchema),
      400: error404,
      500: error500,
    },
  }),
  zValidator("json", userSchema),
  async (c) => {
    const { id, name, email, role, image_url } = c.req.valid("json");
    const rows = await sql`
      INSERT INTO users (id, name, email, role, image_url) 
      VALUES (${id}, ${name}, ${email}, ${role}, ${image_url}) RETURNING *`;
    return c.json(rows[0]);
  },
);

app.put(
  "/users/:id",
  describeRoute({
    method: "put",
    path: "/users/:id",
    tags: ["users"],
    description: "Update an existing user",
    parameter: id_param,
    content: {
      "application/json": {
        schema: resolver(userSchema),
      },
    },
    responses: {
      200: json200(userSchema),
      404: error404,
      500: error500,
    },
  }),
  zValidator("param", z.object({ id: z.string() })),
  zValidator("json", userSchema),
  async (c) => {
    const { id } = c.req.param();
    const { name, email, role, image_url } = c.req.valid("json");
    const rows = await sql`
      UPDATE users SET name = ${name}, email = ${email}, role = ${role}, image_url = ${image_url} 
      WHERE id = ${id} RETURNING *`;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "User not found" });
    }
    return c.json(rows[0]);
  },
);

app.delete(
  "/users/:id",
  describeRoute({
    method: "delete",
    path: "/users/:id",
    tags: ["users"],
    description: "Delete a user",
    parameter: id_param,
    responses: {
      200: resp200,
      404: error404,
      500: error500,
    },
  }),
  zValidator("param", z.object({ id: z.string() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const rows = await sql`
      DELETE FROM users WHERE id = ${id} RETURNING *`;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "User not found" });
    }
    return c.body(null, 200);
  },
);

app.get(
  "/users/:id",
  describeRoute({
    method: "get",
    path: "/users/:id",
    tags: ["users"],
    description: "Get a user by ID",
    parameter: id_param,
    responses: {
      200: json200(userSchema),
      404: error404,
      500: error500,
    },
  }),
  zValidator("param", z.object({ id: z.string() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const rows = await sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.image_url,
        COALESCE(
            ARRAY_AGG(t.name),
            ARRAY[]::VARCHAR[]
        ) AS pinned_tags
    FROM users u
    LEFT JOIN users_pinned_tags upt ON u.id = upt.user_id
    LEFT JOIN tags t ON upt.tag_id = t.id
    WHERE u.id = ${id}
    GROUP BY u.id, u.name, u.email, u.role, u.image_url;
      `;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "User not found" });
    }
    const transformedUser = {
      ...rows[0],
      pinned_tags: Object(rows[0]?.pinned_tags).items ?? [],
    };
    return c.json(transformedUser);
  },
);

const id_tag_param = {
  user_id: {
    name: "user_id",
    in: "path",
    required: true,
    description: "User ID",
    schema: resolver(z.string()),
    example: "1",
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

app.post(
  "/user/:user_id/:tag",
  describeRoute({
    method: "post",
    path: "/user/:user_id/:tag",
    tags: ["users"],
    description: "Add a tag to a user",
    parameter: id_tag_param,
    responses: {
      200: resp200,
      500: error500,
    },
  }),
  zValidator("param", z.object({ user_id: z.string(), tag: z.string() })),
  async (c) => {
    const { user_id, tag } = c.req.valid("param");

    const rows = await sql`
      WITH inserted_tag AS (
        INSERT INTO tags (name) VALUES (${tag}) ON CONFLICT DO NOTHING 
        RETURNING id
      )
      INSERT INTO users_pinned_tags (user_id, tag_id)
      SELECT ${user_id}, COALESCE((SELECT id FROM inserted_tag), 
        (SELECT id FROM tags WHERE name = ${tag} LIMIT 1))
      WHERE NOT EXISTS (
          SELECT 1 FROM users_pinned_tags 
          WHERE user_id = ${user_id} AND tag_id = (
              SELECT id FROM tags WHERE name = ${tag} LIMIT 1
          )
      )
      RETURNING *;
    `;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "Either user or tag not found" });
    }
    return c.body(null, 200);
  },
);

app.delete(
  "/user/:user_id/:tag",
  describeRoute({
    method: "delete",
    path: "/user/:user_id/:tag",
    tags: ["users"],
    description: "Remove a tag from a user",
    parameter: id_tag_param,
    responses: {
      200: resp200,
      500: error500,
    },
  }),
  zValidator("param", z.object({ user_id: z.string(), tag: z.string() })),
  async (c) => {
    const { user_id, tag } = c.req.valid("param");
    const rows = await sql`
      DELETE FROM users_pinned_tags 
      WHERE user_id = ${user_id} AND 
      tag_id = (SELECT id FROM tags WHERE name = ${tag} LIMIT 1)
      RETURNING *;
    `;
    if (rows.length === 0) {
      throw new HTTPException(404, { message: "Either user or tag not found" });
    }
    return c.body(null, 200);
  },
);

export default app;
