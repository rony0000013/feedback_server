import { Hono } from "hono";
import { env } from "hono/adapter";
import "zod-openapi/extend";
import { z } from "zod";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { sql } from "../db.ts";
import { error404, error500, json200, resp200 } from "./error.ts";

// CREATE TABLE IF NOT EXISTS feedbacks (
//     id SERIAL PRIMARY KEY,
//     idea_id INTEGER,
//     user_id TEXT,
//     content TEXT,
//     files_url TEXT [],
//     feedback_links INTEGER [],
//     user_tag TEXT NULL,
//     upvotes INTEGER DEFAULT 0,
//     downvotes INTEGER DEFAULT 0,
//     FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
//     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
// );
// CREATE TABLE IF NOT EXISTS ideas_feedbacks (
//     idea_id INTEGER,
//     feedback_id INTEGER,
//     PRIMARY KEY (idea_id, feedback_id),
//     FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
//     FOREIGN KEY (feedback_id) REFERENCES feedbacks(id) ON DELETE CASCADE
// );

const id_param = {
    id: {
        name: "id",
        in: "path",
        required: true,
        description: "Feedback ID",
        schema: resolver(z.number()),
        example: 1,
    },
};

const feedbackSchema = z.object({
    id: z.number().openapi({
        title: "Feedback ID",
        example: 1,
    }),
    idea_id: z.number().openapi({
        title: "Idea ID",
        example: 1,
    }),
    user_id: z.string().openapi({
        title: "User ID",
        example: "1",
    }),
    content: z.string().openapi({
        title: "Content",
        example: "Feedback content",
    }),
    files_url: z.array(z.string().url()).openapi({
        title: "Files URL",
        example: [
            "https://example.com/file1.jpg",
            "https://example.com/file2.jpg",
        ],
    }),
    feedback_links: z.array(z.number()).openapi({
        title: "Feedback links",
        example: [1, 2],
    }),
    user_tag: z.string().nullable().openapi({
        title: "User tag",
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

const app = new Hono();

app.get(
    "/feedbacks",
    describeRoute({
        method: "get",
        path: "/feedbacks",
        tags: ["feedbacks"],
        description: "Get all feedbacks",
        responses: {
            200: json200(feedbackSchema),
            500: error500,
        },
    }),
    async (c) => {
        const rows = await sql`SELECT * FROM feedbacks`;
        return c.json(rows);
    },
);

app.get(
    "/feedbacks/:id",
    describeRoute({
        method: "get",
        path: "/feedbacks/:id",
        tags: ["feedbacks"],
        description: "Get a feedback by ID",
        parameters: [id_param],
        responses: {
            200: json200(feedbackSchema),
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    async (c) => {
        const { id } = c.req.valid("param");
        const rows = await sql`SELECT * FROM feedbacks WHERE id = ${id}`;
        if (rows.length === 0) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }
        return c.json(rows[0]);
    },
);

app.post(
    "/feedbacks",
    describeRoute({
        method: "post",
        path: "/feedbacks",
        tags: ["feedbacks"],
        description: "Create a new feedback",
        content: {
            "application/json": {
                schema: resolver(feedbackSchema),
            },
        },
        responses: {
            201: json200(feedbackSchema),
            400: error404,
            500: error500,
        },
    }),
    zValidator("json", feedbackSchema),
    async (c) => {
        const {
            idea_id,
            user_id,
            content,
            files_url,
            feedback_links,
            user_tag,
            upvotes,
            downvotes,
        } = c.req.valid("json");
        const rows =
            await sql`INSERT INTO feedbacks (idea_id, user_id, content, files_url, feedback_links, user_tag, upvotes, downvotes) 
        VALUES (${idea_id}, ${user_id}, ${content}, ${files_url}, ${feedback_links}, ${user_tag}, ${upvotes}, ${downvotes}) RETURNING *`;
        if (!rows[0]) {
            throw new HTTPException(400, { message: "Feedback not created" });
        }
        await sql`INSERT INTO ideas_feedbacks (idea_id, feedback_id) VALUES (${idea_id}, ${rows[0].id})`;
        return c.json(rows[0]);
    },
);

app.put(
    "/feedbacks/:id",
    describeRoute({
        method: "put",
        path: "/feedbacks/:id",
        tags: ["feedbacks"],
        description: "Update a feedback by ID",
        parameters: [id_param],
        content: {
            "application/json": {
                schema: resolver(feedbackSchema),
            },
        },
        responses: {
            200: json200(feedbackSchema),
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    zValidator("json", feedbackSchema),
    async (c) => {
        const { id } = c.req.valid("param");
        const {
            idea_id,
            user_id,
            content,
            files_url,
            feedback_links,
            user_tag,
            upvotes,
            downvotes,
        } = c.req.valid("json");
        const rows = await sql`UPDATE feedbacks 
        SET idea_id = ${idea_id}, user_id = ${user_id}, content = ${content}, files_url = ${files_url}, feedback_links = ${feedback_links}, user_tag = ${user_tag}, upvotes = ${upvotes}, downvotes = ${downvotes} WHERE id = ${id} RETURNING *`;
        return c.json(rows[0]);
    },
);

app.delete(
    "/feedbacks/:id",
    describeRoute({
        method: "delete",
        path: "/feedbacks/:id",
        tags: ["feedbacks"],
        description: "Delete a feedback by ID",
        parameters: [id_param],
        responses: {
            200: resp200,
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    async (c) => {
        const { id } = c.req.valid("param");
        await sql`DELETE FROM feedbacks WHERE id = ${id}`;
        await sql`DELETE FROM ideas_feedbacks WHERE feedback_id = ${id}`;
        return c.body(null, 200);
    },
);

app.get("/feedbacks/user/:user_id", describeRoute({
    method: "get",
    path: "/feedbacks/user/:user_id",
    tags: ["feedbacks"],
    description: "Get feedbacks by user ID",
    parameter: id_param,
    responses: {
        200: json200(z.array(feedbackSchema)),
        500: error500,
    },
}), zValidator("param", z.object({ user_id: z.string() })), async (c) => {
    const { user_id } = c.req.valid("param");
    const rows = await sql`SELECT * FROM feedbacks WHERE user_id = ${user_id} ORDER BY created_at DESC`;
    return c.json(rows);
})

app.post("/feedbacks/up/:id",
    describeRoute({
        method: "post",
        path: "/feedbacks/up/:id",
        tags: ["feedbacks"],
        description: "Vote on a feedback",
        parameters: [id_param],
        responses: {
            200: resp200,
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    async (c) => {
        const { id } = c.req.valid("param");
        await sql`UPDATE feedbacks SET upvotes = upvotes + 1 WHERE id = ${id}`;
        return c.body(null, 200);
    },
)

app.delete("/feedbacks/up/:id",
    describeRoute({
        method: "delete",
        path: "/feedbacks/up/:id",
        tags: ["feedbacks"],
        description: "Remove a vote on a feedback",
        parameters: [id_param],
        responses: {
            200: resp200,
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    async (c) => {
        const { id } = c.req.valid("param");
        await sql`UPDATE feedbacks SET upvotes = upvotes - 1 WHERE id = ${id}`;
        return c.body(null, 200);
    },
)

app.post("/feedbacks/down/:id",
    describeRoute({
        method: "post",
        path: "/feedbacks/down/:id",
        tags: ["feedbacks"],
        description: "Vote on a feedback",
        parameters: [id_param],
        responses: {
            200: resp200,
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    async (c) => {
        const { id } = c.req.valid("param");
        await sql`UPDATE feedbacks SET downvotes = downvotes + 1 WHERE id = ${id}`;
        return c.body(null, 200);
    },
)

app.delete("/feedbacks/down/:id",
    describeRoute({
        method: "delete",
        path: "/feedbacks/down/:id",
        tags: ["feedbacks"],
        description: "Remove a vote on a feedback",
        parameters: [id_param],
        responses: {
            200: resp200,
            404: error404,
            500: error500,
        },
    }),
    zValidator("param", z.object({ id: z.number() })),
    async (c) => {
        const { id } = c.req.valid("param");
        await sql`UPDATE feedbacks SET downvotes = downvotes - 1 WHERE id = ${id}`;
        return c.body(null, 200);
    },
)

export default app;
