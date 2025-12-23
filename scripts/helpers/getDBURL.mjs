import "dotenv/config";

// relative paths here because this file is used in some cli and they can't recognize TS path aliases
import { isDev } from "./isDev.mjs";

// not using process.env here directly because I want to keep type safety and validation for env
// but also can't import ts files here because cli blows up
// so I need to pass env as an argument instead of directly importing
const checkEnv = (env) => {
  const prodUrl = env.DATABASE_URL;

  if (!isDev && !prodUrl) {
    console.warn(
      "Production environment detected but no DATABASE_URL was set. Falling back to development db url"
    );
  }
};

export const getDBURL = (env) => {
  checkEnv(env);
  const prodUrl = env.DATABASE_URL;
  return (
    prodUrl ||
    `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.DATABASE_URL_DOMAIN}:${env.DATABASE_URL_PORT}/${env.POSTGRES_DB}`
  );
};

export const getDBURLPrimary = (env) => {
  checkEnv(env);
  const prodUrlPrimary = env.DATABASE_URL_UNPOOLED;

  return prodUrlPrimary || getDBURL(env);
};
