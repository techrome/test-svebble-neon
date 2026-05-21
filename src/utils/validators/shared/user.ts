import { RouterOutput } from "@/trpc";
import { avatarUploadUrlSchemaClient } from "@/utils/validators/client/user";
import { Text } from "@/utils/validators/helpers/text";
import { signupSchemaForm, zEmail } from "@/utils/validators/shared/auth";
import z from "@/utils/zod";

export const avatarSelectSchema = avatarUploadUrlSchemaClient.pick({
  imageExtension: true,
});

export type AvatarUploadUrlSchemaForm = z.infer<
  typeof avatarUploadUrlSchemaClient
>;
export type AvatarSelectSchemaForm = z.infer<typeof avatarSelectSchema>;

export const DISPLAY_NAME_ALLOWED_REGEX = /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u;
export const DISPLAY_NAME_FORBIDDEN_REGEX = /[\r\n\t<>]|\p{C}/u;

export const basicProfileSchemaForm = z.object({
  name: Text.Handle({ required: true }).superRefine((value, ctx) => {
    const ok =
      DISPLAY_NAME_ALLOWED_REGEX.test(value) &&
      !DISPLAY_NAME_FORBIDDEN_REGEX.test(value);
    if (!ok) {
      ctx.addIssue({
        code: "custom",
        message: "Please don't use invalid or hidden characters.",
      });
    }
  }),
});

export type BasicProfileFormValues = z.infer<typeof basicProfileSchemaForm>;

export const usernameSchemaForm = z.object({
  username: signupSchemaForm.shape.username,
});

export type User = NonNullable<RouterOutput["auth"]["user"]["user"]>;

export const makeUsernameSchemaForm = (currentUsername: User["username"]) =>
  usernameSchemaForm.superRefine((data, ctx) => {
    if (data.username.toLowerCase() === String(currentUsername).toLowerCase()) {
      ctx.addIssue({
        code: "custom",
        path: ["username"] satisfies (keyof typeof data)[],
        message: "New username must be different than your current username.",
      });
    }
  });

export type UsernameFormValues = z.infer<typeof usernameSchemaForm>;

export const basePasswordSchemaForm = z
  .object({
    password: signupSchemaForm.shape.password,
    passwordConfirm: signupSchemaForm.shape.password,
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirm) {
      ctx.addIssue({
        code: "custom",
        message: "New passwords do not match.",
        path: ["passwordConfirm"] satisfies (keyof typeof data)[],
      });
    }
  });

export const passwordSchemaForm = basePasswordSchemaForm.safeExtend({
  oldPassword: signupSchemaForm.shape.password.or(z.literal("")),
});

export const makePasswordSchemaForm = (hasOldPassword: boolean) => {
  if (hasOldPassword) {
    return passwordSchemaForm
      .safeExtend({
        oldPassword: passwordSchemaForm.shape.password,
      })
      .superRefine((data, ctx) => {
        if (data.oldPassword === data.password) {
          ctx.addIssue({
            code: "custom",
            message:
              "New password must be different than the current password.",
            path: ["password"] satisfies (keyof typeof data)[],
          });
        }
      });
  } else {
    return passwordSchemaForm;
  }
};

export type PasswordFormValues = z.infer<typeof passwordSchemaForm>;

export const emailSchemaForm = z.object({
  email: zEmail,
});

export const makeEmailChangeSchemaForm = (activeEmail?: string) => {
  return emailSchemaForm.superRefine((data, ctx) => {
    if (activeEmail === data.email) {
      ctx.addIssue({
        code: "custom",
        message: "New email should be different than your active email.",
        path: ["email"] satisfies (keyof typeof data)[],
      });
    }
  });
};

export type EmailFormValues = z.infer<typeof emailSchemaForm>;
