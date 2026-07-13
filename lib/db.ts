import { neon } from "@neondatabase/serverless";

// Lazily create the Neon client so a missing DATABASE_URL only throws when a
// route actually tries to query the database, not at module load / build time.
let _client: ReturnType<typeof neon> | null = null;

function getClient() {
  if (!_client) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Add it in Vercel Project Settings > Environment Variables (or .env.local for local dev)."
      );
    }
    _client = neon(process.env.DATABASE_URL);
  }
  return _client;
}

// Proxy so `sql\`...\`` (tagged template calls) and `sql.query(...)` both
// still work, but the real client is only built on first actual use.
export const sql: any = new Proxy(function () {}, {
  apply(_target, _thisArg, args) {
    return (getClient() as any)(...args);
  },
  get(_target, prop) {
    const client = getClient() as any;
    return client[prop];
  },
});
