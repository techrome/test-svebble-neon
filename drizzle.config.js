import "dotenv/config";
import { defineConfig } from "drizzle-kit";

import { getDBURLPrimary } from "./scripts/helpers/getDBURL.mjs";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDBURLPrimary(),
  },
});
