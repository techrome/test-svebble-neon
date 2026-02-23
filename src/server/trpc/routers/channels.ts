import z from "zod";
import { eq, desc, asc, lt, or, and, sql, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "../../db/core";
import * as schema from "../../db/schema";
import { router } from "../core";
import {
  publicProcedureSSRDefaultRateLimit,
  privateProcedureDefaultRateLimit,
  publicProcedure,
} from "../procedures";
import * as sharedChannelsValidations from "@/utils/validators/shared/channels";
import { throwIfZodError } from "../helpers/validate";
import { P } from "@/utils/permissions";
import { after, before, beforeOrEqual } from "../../db/helpers/time";
import { TRPCError } from "@trpc/server";
import { unionAll } from "drizzle-orm/pg-core";
import {
  createChannelSubscribeTokenRequest,
  publishChannelEvent,
} from "../../websockets/core";
import { waitUntil } from "@vercel/functions";
import { rateLimitMiddlewares } from "../ratelimit";
import { numericIdSchema } from "@/utils/validators/helpers/custom";

type Channel = typeof schema.channels.$inferSelect;

export const channelsRouter = router({
  get: publicProcedureSSRDefaultRateLimit
    .output(
      z.object({
        items: z.array(z.custom<Channel>()),
      })
    )
    .query(async ({ ctx }) => {
      const rate = 0;

      if (Math.random() < rate) throw new Error("idk");
      const rows = await db
        .select()
        .from(schema.channels)
        .where(isNull(schema.channels.deleted_at))
        .orderBy(desc(schema.channels.id));

      return { items: rows.reverse() };
    }),
  create: privateProcedureDefaultRateLimit([P.channels.create])
    .input(sharedChannelsValidations.channelCreateSchemaForm)
    .mutation(async ({ input, ctx }) => {
      throwIfZodError(
        sharedChannelsValidations
          .makeChannelCreateSchemaForm(ctx.user.emailVerified)
          .safeParse(input)
      );

      const [newRow] = await db
        .insert(schema.channels)
        .values({
          name: input.name,
          user_id: ctx.user.id,
        })
        .returning();
      return newRow;
    }),
  update: privateProcedureDefaultRateLimit([P.channels.update])
    .input(sharedChannelsValidations.channelUpdateSchemaForm)
    .mutation(async ({ input, ctx }) => {
      throwIfZodError(
        sharedChannelsValidations
          .makeChannelUpdateSchemaForm(ctx.user.emailVerified)
          .safeParse(input)
      );

      const [updatedRow] = await db
        .update(schema.channels)
        .set({ name: input.name })
        .where(
          and(
            eq(schema.channels.id, input.id),
            eq(schema.channels.user_id, ctx.user.id)
          )
        )
        .returning();

      if (!updatedRow) throw new TRPCError({ code: "NOT_FOUND" });

      return updatedRow;
    }),
  delete: privateProcedureDefaultRateLimit([P.channels.delete])
    .input(sharedChannelsValidations.channelDeleteSchemaForm)
    .mutation(async ({ input, ctx }) => {
      const [deletedRow] = await db
        .update(schema.channels)
        .set({ deleted_at: sql`now()` })
        .where(
          and(
            eq(schema.channels.id, input.id),
            eq(schema.channels.user_id, ctx.user.id)
          )
        )
        .returning();

      if (!deletedRow) throw new TRPCError({ code: "NOT_FOUND" });

      return true;
    }),
  deleteAll: privateProcedureDefaultRateLimit([P.channels.delete]).mutation(
    async () => {
      await db.delete(schema.channels);
    }
  ),
});
