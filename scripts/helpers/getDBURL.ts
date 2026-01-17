import "dotenv/config";

// relative paths because TS path alias not supported here
import { isDev } from "./isDev";
import { env } from "../../src/server/env";

const prodUrl = env.DATABASE_URL;
const prodUrlPrimary = env.DATABASE_URL_UNPOOLED;

if (!isDev && !prodUrl) {
  console.warn(
    "Production environment detected but no DATABASE_URL was set. Falling back to development db url"
  );
}

export const getDBURL = () =>
  prodUrl ||
  `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.DATABASE_URL_DOMAIN}:${env.DATABASE_URL_PORT}/${env.POSTGRES_DB}${env.APPLICATION_NAME ? `?application_name=${env.APPLICATION_NAME}` : ""}`;

export const getDBURLPrimary = () => prodUrlPrimary || getDBURL();
