import "dotenv/config";
import { isDev } from "./isDev.mjs";

const prodUrl = process.env.DATABASE_URL;
const prodUrlPrimary = process.env.DATABASE_URL_UNPOOLED;

if (!isDev && !prodUrl) {
  console.warn(
    "Production environment detected but no DATABASE_URL was set. Falling back to development db url"
  );
}

export const getDBURL = () =>
  prodUrl ||
  `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.DATABASE_URL_DOMAIN}:${process.env.DATABASE_URL_PORT}/${process.env.POSTGRES_DB}`;

export const getDBURLPrimary = () => prodUrlPrimary || getDBURL();
