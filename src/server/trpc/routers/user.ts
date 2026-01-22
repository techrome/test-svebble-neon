import z from "zod";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { router } from "../core";
import {
  publicProcedure,
  privateProcedure,
  privateCachedProcedure,
} from "../procedures";
import { auth } from "../auth";
import { rateLimitMiddlewares } from "../ratelimit";
import { zUsername } from "@/utils/validators/shared/auth";
import { baseURL } from "../auth";
import { ROUTES } from "@/utils/routes";
import {
  allowedAvatarExtensionsMap,
  avatarUploadUrlSchema,
  basicProfileSchemaForm,
  emailSchemaForm,
  makeEmailChangeSchemaForm,
  makePasswordSchemaForm,
  passwordSchemaForm,
  usernameSchemaForm,
} from "@/pages/app/my-profile";
import { TRPCError } from "@trpc/server";
import { PROVIDER_IDS } from "@/utils/constants";
import { getCookieForwarder, throwIfZodError } from "./auth";
import { s3Client } from "../../storage/s3";
import { env } from "../../env";
import { days, minutes } from "@/utils/cacheTime";
import { db, schema } from "../../db";
import { FILE_PURPOSE, FILE_STATUS } from "../../db/helpers/enums";
import { and, eq } from "drizzle-orm";
import { logger } from "@/utils/logger";
import { openAI } from "../helpers/openai";

const cacheControl = `public, max-age=${days(2, true)}`;

const uuidSchema = z.uuid();
const uuidRegex = "([0-9a-fA-F-]{36})";
const fileObjectKeyRegex = new RegExp(
  `^users\\/${uuidRegex}\\/${uuidRegex}\\.(png|jpe?g|webp)$`,
  "i"
);
export const validateUserFileKey = (userId: string, key: string): boolean => {
  const match = fileObjectKeyRegex.exec(key);
  if (!match) return false;

  const [, ownerId, fileId] = match;

  if (
    ownerId !== userId ||
    !uuidSchema.safeParse(ownerId).success ||
    !uuidSchema.safeParse(fileId).success
  ) {
    return false;
  }

  return true;
};

const moderateImage = async (url: string) => {
  const result = await openAI.moderations.create({
    model: "omni-moderation-latest",
    input: [
      {
        type: "image_url",
        image_url: { url },
      },
    ],
  });
  console.log("RESULT:", result.results);
  return result;
};

export const userRouter = router({
  checkUsernameAvailability: publicProcedure
    .use(rateLimitMiddlewares.auth_usernameCheck)
    .input(
      z.object({
        username: zUsername,
      })
    )
    .query(async ({ input }) => {
      const response = await auth.api.isUsernameAvailable({
        body: {
          username: input.username,
        },
      });
      return response;
    }),
  updateUserBasicInfo: privateProcedure
    .use(rateLimitMiddlewares.auth_sensitive)
    .input(
      basicProfileSchemaForm.safeExtend({
        image: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newAvatarKey = input.image;

      if (newAvatarKey && ctx.user.image !== newAvatarKey) {
        if (!validateUserFileKey(ctx.user.id, newAvatarKey)) {
          throw new TRPCError({
            code: "UNPROCESSABLE_CONTENT",
            message: "Invalid avatar key.",
          });
        }
        const [foundPendingAvatarFile] = await db
          .select()
          .from(schema.filesSchema)
          .where(
            and(
              eq(schema.filesSchema.object_key, newAvatarKey),
              eq(schema.filesSchema.owner_user_id, ctx.user.id),
              eq(schema.filesSchema.status, FILE_STATUS.issued)
            )
          );
        if (!foundPendingAvatarFile) {
          throw new TRPCError({
            code: "UNPROCESSABLE_CONTENT",
            message: "Invalid avatar key.",
          });
        }

        let moderationResult: Awaited<ReturnType<typeof moderateImage>>;
        try {
          moderationResult = await moderateImage(
            `${env.NEXT_PUBLIC_CDN_URL}/${newAvatarKey}`
          );
        } catch (err) {
          logger.error(
            "Error moderating avatar",
            err,
            "STRINGIFIED:",
            JSON.stringify(err)
          );
          // if(String(err).includes("")){}
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
          });
        }

        const flagged = moderationResult.results?.[0]?.flagged;
        if (flagged) {
          try {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: env.BACKBLAZE_BUCKET_NAME!,
                Key: newAvatarKey,
              })
            );
            await db
              .update(schema.filesSchema)
              .set({
                status: FILE_STATUS.deleted,
                error_text: `Moderation rejected. Details: ${JSON.stringify(moderationResult.results?.[0])}`,
              })
              .where(eq(schema.filesSchema.object_key, newAvatarKey));
          } catch (err) {
            const errorText = `Failed to delete the avatar image from the bucket. Key was: ${newAvatarKey}. Error: ${JSON.stringify(err)}`;
            logger.error(errorText);
            await db
              .update(schema.filesSchema)
              .set({
                status: FILE_STATUS.error,
                error_text: errorText,
              })
              .where(eq(schema.filesSchema.object_key, newAvatarKey));
          }
          throw new TRPCError({
            code: "UNPROCESSABLE_CONTENT",
            message:
              "Avatar rejected by moderation. Please try a different image.",
          });
        }

        await db.transaction(async (tx) => {
          await tx
            .update(schema.filesSchema)
            .set({ status: FILE_STATUS.inactive })
            .where(
              and(
                eq(schema.filesSchema.owner_user_id, ctx.user.id),
                eq(schema.filesSchema.purpose, FILE_PURPOSE.avatar),
                eq(schema.filesSchema.status, FILE_STATUS.active)
              )
            );

          await tx
            .update(schema.filesSchema)
            .set({ status: FILE_STATUS.active })
            .where(eq(schema.filesSchema.object_key, newAvatarKey));
        });
      }

      return getCookieForwarder(ctx)((opts) =>
        auth.api.updateUser({
          body: {
            name: input.name,
            ...(newAvatarKey !== undefined ? { image: newAvatarKey } : {}),
          },
          ...opts,
        })
      );
    }),
  updateUserUsername: privateProcedure
    .use(rateLimitMiddlewares.auth_sensitive)
    .input(usernameSchemaForm)
    .mutation(async ({ ctx, input }) => {
      const currentUser = ctx.user;

      if (!currentUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }
      const currentRemainingUsernameChanges =
        currentUser.remainingUsernameChanges;

      if (
        !currentRemainingUsernameChanges ||
        currentRemainingUsernameChanges < 1
      ) {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "You cannot change your username.",
        });
      }

      if (
        input.username.toLowerCase() === currentUser.username?.toLowerCase()
      ) {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "New username must be different than your current username.",
        });
      }

      return getCookieForwarder(ctx)((opts) =>
        auth.api.updateUser({
          body: {
            username: input.username,
            hasRandomUsername: false,
            remainingUsernameChanges: Math.max(
              0,
              currentRemainingUsernameChanges - 1
            ),
          },
          ...opts,
        })
      );
    }),
  changeUserPassword: privateCachedProcedure
    .use(rateLimitMiddlewares.auth_sensitive)
    .input(passwordSchemaForm)
    .mutation(async ({ input, ctx }) => {
      const cookieForwarder = getCookieForwarder(ctx);

      const userAccounts = await cookieForwarder((opts) =>
        auth.api.listUserAccounts({ ...opts })
      );

      const hasOldPassword = userAccounts.some(
        (account) => account.providerId === PROVIDER_IDS.credential
      );
      if (hasOldPassword) {
        throwIfZodError(
          makePasswordSchemaForm(hasOldPassword).safeParse(input)
        );
        return cookieForwarder((opts) =>
          auth.api.changePassword({
            body: {
              currentPassword: input.oldPassword,
              newPassword: input.password,
            },
            ...opts,
          })
        );
      } else {
        return cookieForwarder((opts) =>
          auth.api.setPassword({
            body: { newPassword: input.password },
            ...opts,
          })
        );
      }
    }),
  changeEmail: privateProcedure
    .use(rateLimitMiddlewares.auth_changeEmail)
    .input(emailSchemaForm)
    .mutation(async ({ ctx, input }) => {
      const cookieForwarder = getCookieForwarder(ctx);

      throwIfZodError(
        makeEmailChangeSchemaForm(ctx.user.email).safeParse(input)
      );

      await cookieForwarder((opts) =>
        auth.api.updateUser({
          body: {
            pendingEmail: input.email || null,
            pendingEmailSetAt: input.email ? new Date() : null,
          },
          ...opts,
        })
      );
      try {
        await cookieForwarder((opts) =>
          auth.api.changeEmail({
            body: {
              newEmail: input.email,
              callbackURL: `${baseURL}/${ROUTES.private_emailVerified}`,
            },
            ...opts,
          })
        );
      } catch (_err) {
        // intentionally do nothing so that the user won't know whether
        // the email already exists (prevents email enumeration attacks)
      }
      return { email: input.email };
    }),
  cancelPendingEmail: privateCachedProcedure
    .use(rateLimitMiddlewares.auth_changeEmail)
    .mutation(async ({ ctx }) => {
      return getCookieForwarder(ctx)((opts) =>
        auth.api.updateUser({
          body: {
            pendingEmail: null,
            pendingEmailSetAt: null,
          },
          ...opts,
        })
      );
    }),
  listUserAccounts: privateCachedProcedure
    .use(rateLimitMiddlewares.auth_normal)
    .input(
      z.object({
        // unused id just for cache busting on the client
        id: z.string(),
      })
    )
    .query(({ ctx }) =>
      getCookieForwarder(ctx)((opts) =>
        auth.api.listUserAccounts({
          ...opts,
        })
      )
    ),
  createAvatarUploadUrl: privateCachedProcedure
    .use(rateLimitMiddlewares.auth_avatarUpload)
    .input(avatarUploadUrlSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const fileExtension = allowedAvatarExtensionsMap[input.fileType];

      const bucketKey = `users/${userId}/${randomUUID()}.${fileExtension}`;

      const uploadCommand = new PutObjectCommand({
        Bucket: env.BACKBLAZE_BUCKET_NAME!,
        Key: bucketKey,
        ContentType: input.fileType,
        ContentLength: input.fileSize,
        CacheControl: cacheControl,
      });

      const expiresIn = minutes(1, true);

      const uploadUrl = await getSignedUrl(s3Client, uploadCommand, {
        expiresIn,
        signableHeaders: new Set(["content-type", "cache-control"]),
      });

      await db.insert(schema.filesSchema).values({
        object_key: bucketKey,
        owner_user_id: userId,
        purpose: FILE_PURPOSE.avatar,
        status: FILE_STATUS.issued,
      });

      return {
        bucketKey,
        uploadUrl,
        requiredHeaders: {
          "Content-Type": input.fileType,
          "Cache-Control": cacheControl,
        } as const,
      };
    }),
  deleteUser: privateProcedure
    .use(rateLimitMiddlewares.auth_sensitive)
    .mutation(async ({ ctx }) => {
      return getCookieForwarder(ctx)((opts) =>
        auth.api.deleteUser({
          body: {},
          ...opts,
        })
      );
    }),
});
