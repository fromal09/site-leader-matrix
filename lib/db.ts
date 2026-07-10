import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Add it in your Vercel project settings or .env.local."
  );
}

export const sql = neon(process.env.DATABASE_URL ?? "");
