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
    username: Text.Handle({ required: true }),
    email: Text.Title().pipe(z.email()).optional().or(z.literal("")),
    password: zPassword,
    passwordConfirm: Text.Title({ shouldTrim: false, required: true }),
    agreeTerms: z.boolean().refine((v) => Boolean(v), {
      error: "You must agree to the Terms and Privacy Policy",
    }),
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
