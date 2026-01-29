import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

// relative paths because this file is used in some cli and they don't support TS path aliases
import { getDBURL } from "../../../scripts/helpers/getDBURL";
import * as schema from "./schema";

const dbUrl = getDBURL();
const pool = new Pool({ connectionString: dbUrl });

export const db = drizzle({
  client: pool,
  schema,
});
