import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";

// relative paths because this file is used in some cli and they don't support TS path aliases
import { getDBURL } from "../../../scripts/helpers/getDBURL";
import { env } from "../env";
import * as schema from "./schema";

export const db = env.DATABASE_URL
  ? drizzleNeon({ client: neon(env.DATABASE_URL), schema })
  : drizzlePg({
      connection: {
        connectionString: getDBURL(),
      },
      schema,
    });
