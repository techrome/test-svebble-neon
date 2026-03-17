import React, { useEffect, useState } from "react";
import z from "zod";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { CircularProgress, Typography } from "@mui/material";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Section, VerticalStack } from "@/components/Layout/Containers";
import { trpc } from "@/trpc";
import Input from "@/components/Fields/Input";
import Button from "@/components/Button/Button";
import { TermsLabel } from "@/components/AuthForm/Helpers";
import Link from "@/components/Link/Link";
import { ROUTES } from "@/utils/routes";
import { PasswordStrengthMeter } from "@/components/AuthForm/Signup";
import { useRouter } from "next/router";
import { basePasswordSchemaForm } from "@/utils/validators/shared/user";
import { getRouterQueryValue } from "@/utils/query";

export const resetPasswordSchemaForm = basePasswordSchemaForm.safeExtend({
  token: z.string().min(1),
});

type FormValues = z.infer<typeof resetPasswordSchemaForm>;

const emptyFormValues: FormValues = {
  password: "",
  passwordConfirm: "",
  token: "",
};

const ResetPassword = () => {
  const [passwordFieldWasFocused, setPasswordFieldWasFocused] = useState(false);

  const router = useRouter();

  const form = useForm<FormValues>({
    defaultValues: emptyFormValues,
    resolver: zodResolver(resetPasswordSchemaForm),
  });

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    resetPasswordMutation.mutate(values);
  };

  const token = getRouterQueryValue(router.query.token);
  const error = getRouterQueryValue(router.query.error);

  const isSubmitting = resetPasswordMutation.isPending;

  useEffect(() => {
    if (token) {
      form.setValue("token", token);
    }
    // eslint-disable-next-line
  }, [token]);

  if (!router.isReady) {
    return (
      <Section addClassName="flex justify-center">
        <CircularProgress />
      </Section>
    );
  }

  if (error || !token) {
    return (
      <Section>
        <VerticalStack addClassName="justify-center items-center">
          <Typography variant="h2" component="div">
            <ErrorIcon fontSize="inherit" color="error" />
          </Typography>
          <Typography variant="h5" textAlign="center">
            Password reset link is either expired or invalid.
          </Typography>
          <Link href={ROUTES.home} className="w-md max-w-full">
            <Button variant="contained" color="primary" size="large" fullWidth>
              Return to Home page
            </Button>
          </Link>
        </VerticalStack>
      </Section>
    );
  }

  return (
    <Section>
      {resetPasswordMutation.isSuccess ? (
        <VerticalStack addClassName="justify-center items-center">
          <Typography variant="h2" component="div">
            <CheckCircleIcon fontSize="inherit" color="success" />
          </Typography>
          <Typography variant="h5" textAlign="center">
            You password has been successfully reset.
          </Typography>
          <Link href={ROUTES.logIn} className="w-md max-w-full">
            <Button variant="contained" color="primary" size="large" fullWidth>
              Log in
            </Button>
          </Link>
        </VerticalStack>
      ) : (
        <>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <VerticalStack>
              <Typography variant="h6" component="h1">
                Password reset
              </Typography>
              <Typography>Write a new password below.</Typography>
              <div>
                <Input
                  control={form.control}
                  name="password"
                  label="New password"
                  fullWidth
                  type="password"
                  autoComplete="new-password"
                  endAccessory="passwordVisibility"
                  onFocus={() => {
                    setPasswordFieldWasFocused(true);
                  }}
                />
                <PasswordStrengthMeter
                  form={form}
                  passwordFieldWasFocused={passwordFieldWasFocused}
                />
              </div>
              <Input
                control={form.control}
                name="passwordConfirm"
                label="New password confirmation"
                fullWidth
                type="password"
                autoComplete="new-password"
                endAccessory="passwordVisibility"
              />
              <Button
                variant="contained"
                type="submit"
                size="large"
                isLoading={isSubmitting}
              >
                Reset password
              </Button>
            </VerticalStack>
          </form>
          <TermsLabel />
        </>
      )}
    </Section>
  );
};

export default ResetPassword;
