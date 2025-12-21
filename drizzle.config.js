import "dotenv/config";
import { defineConfig } from "drizzle-kit";

import { getDBURLPrimary } from "./scripts/helpers/getDBURL.mjs";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDBURLPrimary(),
  },
});
