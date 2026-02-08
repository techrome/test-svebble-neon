import z from "zod";

import { router } from "../core";
import { publicProcedureSSRDefaultRateLimit } from "../procedures";
import { authRouter } from "./auth";
import { userRouter } from "./user";
import { messagesRouter } from "./messages";

export const appRouter = router({
  hello: publicProcedureSSRDefaultRateLimit
    .input(
      z.object({
        text: z.string(),
      })
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
  globalData: publicProcedureSSRDefaultRateLimit.query(() => ({
    links: ["a1", "a2", "a3"],
  })),
  auth: authRouter,
  user: userRouter,
  messages: messagesRouter,
});

export type AppRouter = typeof appRouter;
