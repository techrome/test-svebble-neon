import React from "react";
import z from "zod";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Typography } from "@mui/material";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Section, VerticalStack } from "@/components/Layout/Containers";
import { forgotPasswordSchemaForm } from "@/utils/validators/shared/auth";
import { trpc } from "@/trpc";
import Input from "@/components/Fields/Input";
import Button from "@/components/Button/Button";
import { TermsLabel } from "@/components/AuthForm/Helpers";

type FormValues = z.infer<typeof forgotPasswordSchemaForm>;

const emptyFormValues: FormValues = {
  email: "",
};

const ForgotPassword = () => {
  const form = useForm<FormValues>({
    defaultValues: emptyFormValues,
    resolver: zodResolver(forgotPasswordSchemaForm),
  });

  const forgotPasswordMutation = trpc.auth.requestPasswordReset.useMutation();

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    forgotPasswordMutation.mutate(values);
  };

  const isSubmitting = forgotPasswordMutation.isPending;

  return (
    <Section addClassName="mt-5">
      {forgotPasswordMutation.isSuccess ? (
        <VerticalStack addClassName="justify-center">
          <Typography variant="h2" component="div" textAlign="center">
            <CheckCircleIcon fontSize="inherit" color="success" />
          </Typography>
          <Typography variant="h5" textAlign="center">
            Account recovery email sent to{" "}
            <strong>{form.getValues("email")}</strong>
          </Typography>
          <Typography textAlign="center">
            If you don’t see this email in your inbox within 15 minutes, look
            for it in your spam mail folder.
          </Typography>
        </VerticalStack>
      ) : (
        <>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <VerticalStack>
              <Typography>
                Forgot your account’s password? Enter your email address and
                we’ll send you a recovery link.
              </Typography>
              <Input
                control={form.control}
                name="email"
                label="Email"
                type="text"
                autoComplete="email"
                fullWidth
                autoFocus
              />
              <Button
                variant="contained"
                type="submit"
                size="large"
                isLoading={isSubmitting}
              >
                Send recovery email
              </Button>
            </VerticalStack>
          </form>
          <TermsLabel />
        </>
      )}
    </Section>
  );
};

export default ForgotPassword;
