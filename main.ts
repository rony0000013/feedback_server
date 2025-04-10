import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { apiReference } from "@scalar/hono-api-reference";
import "zod-openapi/extend";
import { z } from "zod";
import { swaggerUI } from "@hono/swagger-ui";
import { describeRoute, openAPISpecs } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { handle } from "hono/aws-lambda"

import users from "./routes/users.ts";
// import tags from "./routes/tags.ts";
// import ideas from "./routes/ideas.ts";
import sql from "./db.ts";

const app = new Hono();
app.use(logger());

app.get("/swagger", swaggerUI({ url: "/doc" }));

app.get(
	"/ui",
	apiReference({
		url: "/doc",
	}),
);

app.use(
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"X-Requested-With",
			"Accept",
			"*",
		],
		credentials: true,
	}),
);

// app.use((c, next) => {
//   c.set("sql", sql);
//   return next();
// });

const querySchema = z.object({
	name: z.string().optional().openapi({
		title: "Name",
		example: "Hono",
		description: "Name of the user",
	}),
});

app.onError((error, c) => {
	if (error instanceof HTTPException) {
		const err = error as HTTPException;
		return c.json(
			{
				name: err.name,
				message: err.message,
			},
			err.status ?? 500,
		);
	}
	return c.json(
		{
			name: error.name,
			message: error.message,
		},
		500,
	);
});

app.get(
	"/",
	describeRoute({
		method: "get",
		path: "/",
		description: "Say hello to the user",
		request: {
			query: resolver(querySchema),
		},
		responses: {
			200: {
				description: "Successful response",
				content: {
					"text/plain": {
						schema: resolver(z.string()),
						example: "Hello Hono!",
					},
				},
			},
		},
	}),
	zValidator("query", querySchema),
	async (c) => {
		const { name } = c.req.query();
		return c.text(`Hello ${name ?? "Hono"}!`, 200);
	},
);

app.route("/", users);
// app.route("/", tags);
// app.route("/", ideas);

app.get(
	"/doc",
	openAPISpecs(app, {
		documentation: {
			info: {
				title: "Feedback Server",
				version: "1.0.0",
				description: "Feedback project API",
			},
			servers: [
				{
					url: "http://localhost:8000",
					description: "Local server",
				},
				{
					url: "https://feedback-server-5mu9.onrender.com",
					description: "Production server",
				},
			],
		},
	}),
);


export const handler = handle(app);

export default {
	port: 8000,
	fetch: app.fetch,
};
