import "dotenv/config";
import { defineConfig } from "drizzle-kit";

import { getDBURLPrimary } from "./scripts/helpers/getDBURL";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/server/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: getDBURLPrimary(),
  },
});
