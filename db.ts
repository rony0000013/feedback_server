import postgres from "postgres";

if (!process.env.PGURL) {
    throw new Error("PGURL is not defined");
}

const sql = postgres(process.env.PGURL, {
    ssl: {
        rejectUnauthorized: false,
    },
});

// await Promise.all([
//     sql`
//     CREATE TABLE IF NOT EXISTS users (
//         id TEXT PRIMARY KEY,
//         name TEXT,
//         email TEXT,
//         role TEXT,
//         image_url TEXT
//     );`,
//     sql`
//     CREATE TABLE IF NOT EXISTS tags (
//         id SERIAL PRIMARY KEY,
//         name TEXT UNIQUE,
//         upvotes INTEGER DEFAULT 0,
//         downvotes INTEGER DEFAULT 0
//     );`,
//     sql`
//     CREATE TABLE IF NOT EXISTS users_pinned_tags (
//         user_id TEXT NOT NULL,
//         tag_id INTEGER NOT NULL,
//         PRIMARY KEY (user_id, tag_id),
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
//     );`,
//     sql`
//     CREATE TABLE IF NOT EXISTS groups (
//         id SERIAL PRIMARY KEY,
//         title TEXT,
//         description TEXT,
//         user_id TEXT [],
//         likes INTEGER DEFAULT 0
//     );`,
//     sql`
//     CREATE TABLE IF NOT EXISTS ideas (
//         id SERIAL PRIMARY KEY,
//         title TEXT,
//         content TEXT,
//         user_id TEXT,
//         files_url TEXT [],
//         access TEXT, -- 'public', 'private:user_id', 'group:group_id'
//         upvotes INTEGER DEFAULT 0,
//         downvotes INTEGER DEFAULT 0,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
//     );`,
//     sql`
//     CREATE TABLE IF NOT EXISTS ideas_tags (
//         idea_id INTEGER,
//         tag_id INTEGER,
//         PRIMARY KEY (idea_id, tag_id),
//         FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
//         FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
//     );`,
//     sql`
//     CREATE TABLE IF NOT EXISTS feedbacks (
//         id SERIAL PRIMARY KEY,
//         idea_id INTEGER,
//         user_id TEXT,
//         content TEXT,
//     files_url TEXT [],
//     feedback_links INTEGER [],
//         user_tag TEXT NULL,
//         upvotes INTEGER DEFAULT 0,
//         downvotes INTEGER DEFAULT 0,
//         FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
//     );`,
//     sql`
//     CREATE TABLE IF NOT EXISTS ideas_feedbacks (
//         idea_id INTEGER,
//         feedback_id INTEGER,
//         PRIMARY KEY (idea_id, feedback_id),
//         FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
//         FOREIGN KEY (feedback_id) REFERENCES feedbacks(id) ON DELETE CASCADE
//     );`,
//     sql`
//     CREATE INDEX IF NOT EXISTS tags_name_index ON tags (name);
//     `,
//     sql`
//     CREATE INDEX IF NOT EXISTS tags_id_index ON tags (id);
//     `,
// ]);

export default sql;
