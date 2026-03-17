import z from "zod";
import { eq, desc, and, sql, isNull } from "drizzle-orm";

import { db } from "../../db/core";
import * as schema from "../../db/schema";
import { router } from "../core";
import {
  publicProcedureSSRDefaultRateLimit,
  privateProcedure,
} from "../procedures";
import * as sharedChannelsValidations from "@/utils/validators/shared/channels";
import { throwIfZodError } from "../helpers/validate";
import { P } from "@/utils/permissions";
import { TRPCError } from "@trpc/server";

import { numericIdQuerySchema } from "@/utils/validators/helpers/custom";

type Channel = typeof schema.channels.$inferSelect;

export const channelsRouter = router({
  get: publicProcedureSSRDefaultRateLimit
    .output(
      z.object({
        items: z.array(z.custom<Channel>()),
      })
    )
    .query(async () => {
      const rows = await db
        .select()
        .from(schema.channels)
        .where(isNull(schema.channels.deleted_at))
        .orderBy(desc(schema.channels.id));

      return { items: rows.reverse() };
    }),
  getMessagesVersion: publicProcedureSSRDefaultRateLimit
    .input(
      z.object({
        channelId: numericIdQuerySchema,
      })
    )
    .query(async ({ input }) => {
      const [channelRow] = await db
        .select({ messages_version: schema.channels.messages_version })
        .from(schema.channels)
        .where(
          and(
            isNull(schema.channels.deleted_at),
            eq(schema.channels.id, input.channelId)
          )
        )
        .limit(1);

      if (!channelRow) throw new TRPCError({ code: "NOT_FOUND" });

      return channelRow.messages_version;
    }),
  create: privateProcedure([P.channels.create])
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
  update: privateProcedure([P.channels.update])
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
            isNull(schema.channels.deleted_at),
            eq(schema.channels.id, input.id),
            eq(schema.channels.user_id, ctx.user.id)
          )
        )
        .returning();

      if (!updatedRow) throw new TRPCError({ code: "NOT_FOUND" });

      return updatedRow;
    }),
  delete: privateProcedure([P.channels.delete])
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
  deleteAll: privateProcedure([P.channels.delete]).mutation(async () => {
    await db.delete(schema.channels);
  }),
});
