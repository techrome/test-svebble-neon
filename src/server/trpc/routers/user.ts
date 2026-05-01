import z from "@/utils/zod";
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
} from "@/utils/validators/shared/user";
import { TRPCError } from "@trpc/server";
import { PROVIDER_IDS } from "@/utils/constants";
import { getCookieForwarder } from "./auth";
import { s3Client } from "../../storage/s3";
import { env } from "../../env";
import { env as clientEnv } from "@/utils/env";
import { days, minutes } from "@/utils/cacheTime";
import { db, schema } from "../../db";
import { FILE_PURPOSE, FILE_STATUS } from "../../db/helpers/enums";
import { and, eq, inArray, sql } from "drizzle-orm";
import { openAI } from "../helpers/openai";
import { PLACEHOLDER_EMAIL_DOMAIN } from "@/trpc/helpers/email";
import { isDev } from "@/utils/isDev";
import { probeImageDimensions } from "../helpers/probeImage";
import { P } from "@/utils/permissions";
import { throwIfZodError } from "../helpers/validate";

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

  if (ownerId !== userId || !uuidSchema.safeParse(fileId).success) {
    return false;
  }

  return true;
};

type ModerationResult = Awaited<ReturnType<typeof openAI.moderations.create>>;

const moderateImage = async (url: string): Promise<ModerationResult> => {
  if (isDev) {
    return { id: "dev", model: "dev", results: [] };
  }
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

const avatarDimensionsSchema = avatarUploadUrlSchema.omit({
  imageType: true,
  imageSize: true,
});

export const userRouter = router({
  checkUsernameAvailability: publicProcedure(
    rateLimitMiddlewares.auth_usernameCheck
  )
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
  updateUserBasicInfo: privateProcedure(
    [P.user.basicInfo.update, P.user.avatar.update],
    rateLimitMiddlewares.auth_sensitive
  )
    .input(
      basicProfileSchemaForm.safeExtend({
        image: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newAvatarKey = input.image;
      const newAvatarIsDifferent = ctx.user.image !== newAvatarKey;

      if (newAvatarIsDifferent && newAvatarKey) {
        if (!validateUserFileKey(ctx.user.id, newAvatarKey)) {
          throw new TRPCError({
            code: "UNPROCESSABLE_CONTENT",
            message: "Invalid avatar key.",
          });
        }
        const [foundPendingAvatarFile] = await db
          .select()
          .from(schema.files)
          .where(
            and(
              eq(schema.files.object_key, newAvatarKey),
              eq(schema.files.owner_user_id, ctx.user.id),
              eq(schema.files.status, FILE_STATUS.issued)
            )
          );
        if (!foundPendingAvatarFile) {
          throw new TRPCError({
            code: "UNPROCESSABLE_CONTENT",
            message: "Invalid avatar key.",
          });
        }
        const newAvatarUrl = `${clientEnv.NEXT_PUBLIC_CDN_URL}/${newAvatarKey}`;
        const probeResult = await probeImageDimensions(newAvatarUrl);
        console.log({ probeResult });

        throwIfZodError(
          avatarDimensionsSchema.safeParse({
            imageWidth: probeResult.width,
            imageHeight: probeResult.height,
          } satisfies z.infer<typeof avatarDimensionsSchema>)
        );

        let moderationResult: Awaited<ReturnType<typeof moderateImage>>;
        try {
          moderationResult = await moderateImage(newAvatarUrl);
        } catch (err) {
          console.error(
            "Error moderating avatar",
            err,
            "STRINGIFIED:",
            JSON.stringify(err)
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
          });
        }

        const flagged = moderationResult.results?.[0]?.flagged || false;
        if (flagged) {
          try {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: env.BACKBLAZE_BUCKET_NAME!,
                Key: newAvatarKey,
              })
            );
            await db
              .update(schema.files)
              .set({
                status: FILE_STATUS.deleted,
                info_text: `Moderation rejected. Details: ${JSON.stringify(moderationResult.results?.[0])}`,
              })
              .where(eq(schema.files.object_key, newAvatarKey));
          } catch (err) {
            const errorText = `Failed to delete the avatar image from the bucket. Key was: ${newAvatarKey}. Error: ${JSON.stringify(err)}`;
            console.error(errorText);
            await db
              .update(schema.files)
              .set({
                status: FILE_STATUS.error,
                error_text: errorText,
              })
              .where(eq(schema.files.object_key, newAvatarKey));
          }
          throw new TRPCError({
            code: "UNPROCESSABLE_CONTENT",
            message:
              "Avatar rejected by moderation. Please try a different image.",
          });
        }

        await db.transaction(async (tx) => {
          await tx
            .update(schema.files)
            .set({ status: FILE_STATUS.inactive })
            .where(
              and(
                eq(schema.files.owner_user_id, ctx.user.id),
                eq(schema.files.purpose, FILE_PURPOSE.avatar),
                eq(schema.files.status, FILE_STATUS.active)
              )
            );

          await tx
            .update(schema.files)
            .set({ status: FILE_STATUS.active })
            .where(eq(schema.files.object_key, newAvatarKey));
        });
      } else if (newAvatarIsDifferent && newAvatarKey === null) {
        await db
          .update(schema.files)
          .set({ status: FILE_STATUS.inactive })
          .where(
            and(
              eq(schema.files.owner_user_id, ctx.user.id),
              eq(schema.files.purpose, FILE_PURPOSE.avatar),
              eq(schema.files.status, FILE_STATUS.active)
            )
          );
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
  updateUserUsername: privateProcedure(
    [P.user.username.update],
    rateLimitMiddlewares.auth_sensitive
  )
    .input(usernameSchemaForm)
    .mutation(async ({ ctx, input }) => {
      const currentUser = ctx.user;

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
  changeUserPassword: privateProcedure(
    [P.user.password.update],
    rateLimitMiddlewares.auth_sensitive
  )
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
  changeEmail: privateProcedure(
    [P.user.email.update],
    rateLimitMiddlewares.auth_changeEmail
  )
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
              callbackURL: `${baseURL}${ROUTES.private_emailVerified}`,
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
  cancelPendingEmail: privateCachedProcedure(
    [P.user.email.update],
    rateLimitMiddlewares.auth_changeEmail
  ).mutation(async ({ ctx }) => {
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
  listUserAccounts: privateCachedProcedure(
    [P.account.read],
    rateLimitMiddlewares.auth_normal
  )
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
  createAvatarUploadUrl: privateProcedure(
    [P.user.avatar.create],
    rateLimitMiddlewares.auth_avatarUpload
  )
    .input(avatarUploadUrlSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const fileExtension = allowedAvatarExtensionsMap[input.imageType];

      const bucketKey = `users/${userId}/${randomUUID()}.${fileExtension}`;

      const uploadCommand = new PutObjectCommand({
        Bucket: env.BACKBLAZE_BUCKET_NAME!,
        Key: bucketKey,
        ContentType: input.imageType,
        ContentLength: input.imageSize,
        CacheControl: cacheControl,
      });

      const expiresIn = minutes(1, true);

      const uploadUrl = await getSignedUrl(s3Client, uploadCommand, {
        expiresIn,
        signableHeaders: new Set(["content-type", "cache-control"]),
      });

      await db.insert(schema.files).values({
        object_key: bucketKey,
        owner_user_id: userId,
        purpose: FILE_PURPOSE.avatar,
        status: FILE_STATUS.issued,
      });

      return {
        bucketKey,
        uploadUrl,
        requiredHeaders: {
          "Content-Type": input.imageType,
          "Cache-Control": cacheControl,
        } as const,
      };
    }),
  deleteUser: privateProcedure(
    [P.user.delete],
    rateLimitMiddlewares.auth_sensitive
  ).mutation(async ({ ctx }) => {
    if (ctx.user.deletedAt) {
      throw new TRPCError({
        code: "UNPROCESSABLE_CONTENT",
        message: "Your account is already in the process of being deleted.",
      });
    }
    const userId = ctx.user.id;

    const verificationIdentifiers = [
      ctx.user.email,
      ctx.user.pendingEmail,
    ].filter((v): v is string => typeof v === "string" && v.length > 0);

    const cookieForwarder = getCookieForwarder(ctx);
    const logoutRes = await cookieForwarder((opts) =>
      auth.api.signOut({
        ...opts,
      })
    );

    await db.transaction(async (tx) => {
      await tx
        .update(schema.user)
        .set({
          deletedAt: sql`now()`,
          name: "Deleted user",
          image: null,
          email: `deleted+${userId}@${PLACEHOLDER_EMAIL_DOMAIN}`.toLowerCase(),
          emailVerified: false,
          displayUsername: null,
          username: null,
          remainingUsernameChanges: null,
          hasRandomUsername: false,
          pendingEmail: null,
          pendingEmailSetAt: null,
        })
        .where(eq(schema.user.id, userId));

      await tx.delete(schema.session).where(eq(schema.session.userId, userId));
      await tx.delete(schema.account).where(eq(schema.account.userId, userId));

      if (verificationIdentifiers.length > 0) {
        await tx
          .delete(schema.verification)
          .where(
            inArray(schema.verification.identifier, verificationIdentifiers)
          );
      }
    });

    return logoutRes;
  }),
});
