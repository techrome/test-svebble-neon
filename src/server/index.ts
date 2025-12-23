if (typeof window !== "undefined") {
  throw new Error("Server code must not be imported on the client");
}

export * as trpc from "./trpc";
export * as utils from "./utils";
export * as dbUtils from "./db";
export { env } from "./env";

export type * from "./types";
