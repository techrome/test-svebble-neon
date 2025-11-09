import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { getDBURL } from "@/db/helpers/getDBURL";
// test
export const db = process.env.DATABASE_URL
  ? drizzleNeon(neon(process.env.DATABASE_URL))
  : drizzlePg({
      connection: {
        connectionString: getDBURL(),
      },
    });
