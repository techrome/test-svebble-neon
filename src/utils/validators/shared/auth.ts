import z from "zod";

import { requiredPasswordRules } from "@/components/AuthForm/Signup";
import { Text } from "@/utils/validators/helpers/text";

export const passwordMinLength = 8;
export const passwordCheck = z.string().min(passwordMinLength);

export const zUsername = Text.Handle()
  .min(3, "Username must be at least 3 characters")
  .regex(
    /^[A-Za-z0-9_\.]+$/,
    "Please use only English letters, numbers, underscore or period"
  )
  .refine(
    (value) =>
      !["__", "..", "_.", "._"].some((invalidStr) =>
        value.includes(invalidStr)
      ),
    "Please don't use consecutive underscores/periods"
  );

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

export const zEmail = Text.Title().pipe(z.email());

export const signupSchemaForm = z
  .object({
    username: zUsername,
    email: zEmail.optional().or(z.literal("")),
    password: zPassword,
    passwordConfirm: zPassword,
  })
  .refine((data) => data.password === data.passwordConfirm, {
    error: "Passwords do not match",
    path: ["passwordConfirm"],
  });

export const loginSchemaForm = z.object({
  usernameOrEmail: Text.Handle().min(
    3,
    "Username or email must be at least 3 characters"
  ),
  password: zPassword,
  rememberMe: z.boolean(),
});

export const forgotPasswordSchemaForm = z.object({
  email: zEmail,
});
