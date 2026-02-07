import { TRPCError } from "@trpc/server";
import z from "zod";

export const throwIfZodError: <TInput>(
  parseResult: z.ZodSafeParseResult<TInput>
) => asserts parseResult is z.ZodSafeParseSuccess<TInput> = (parseResult) => {
  if (!parseResult.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      cause: parseResult.error,
    });
  }
};
