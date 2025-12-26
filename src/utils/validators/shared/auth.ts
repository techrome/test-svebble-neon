import z from "zod";

import { requiredPasswordRules } from "@/components/AuthForm/Signup";
import { Text } from "@/utils/validators/helpers/text";

export const passwordMinLength = 8;
export const passwordCheck = z.string().min(passwordMinLength);

export const zPassword = Text.Title({
  shouldTrim: false,
  required: true,
}).superRefine((password, ctx) => {
  requiredPasswordRules.forEach((rule) => {
    if (!rule.validate(password)) {
      ctx.addIssue({
        code: "custom",
        message: rule.error,
      });
    }
  });
});

export const signupSchemaForm = z
  .object({
    username: Text.Handle()
      .min(3, "Username must be at least 3 characters")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Use only English letters, numbers, underscore or hyphen"
      )
      .refine(
        (value) =>
          !["__", "--"].some((invalidStr) => value.includes(invalidStr)),
        "Don't use consecutive underscores/hyphens"
      ),
    email: Text.Title().pipe(z.email()).optional().or(z.literal("")),
    password: zPassword,
    passwordConfirm: Text.Title({ shouldTrim: false, required: true }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    error: "Passwords do not match",
    path: ["passwordConfirm"],
  });

export const loginSchemaForm = z.object({
  username: Text.Handle({ required: true }),
  password: Text.Title({ shouldTrim: false, required: true }),
  rememberMe: z.boolean(),
});
