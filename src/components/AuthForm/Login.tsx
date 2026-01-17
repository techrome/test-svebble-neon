import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import z from "zod";

import {
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import Button from "@/components/Button/Button";
import Checkbox from "@/components/Fields/Checkbox";
import Input from "@/components/Fields/Input";
import { loginSchemaForm } from "@/utils/validators/shared/auth";
import { AuthWrapper } from "@/components/AuthForm/Helpers";
import { trpc } from "@/trpc";
import useIsDesktop from "@/utils/hooks/useIsDesktop";
import { userLoginLifecycle } from "@/trpc/helpers/userLifecycle";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  onSuccess?: () => void;
  onForgotPasswordClick?: () => void;
};

type FormValues = z.infer<typeof loginSchemaForm>;

const emptyFormValues: FormValues = {
  usernameOrEmail: "",
  password: "",
  rememberMe: false,
};

const Login = (props: Props) => {
  const form = useForm<FormValues>({
    defaultValues: emptyFormValues,
    resolver: zodResolver(loginSchemaForm),
  });

  const isDesktop = useIsDesktop();

  const qc = useQueryClient();
  const loginMutation = trpc.auth.loginCredentials.useMutation({
    onSuccess() {
      userLoginLifecycle(qc);
      props.onSuccess?.();
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    loginMutation.mutate(values);
  };

  const isSubmitting = loginMutation.isPending;

  return (
    <Section addClassName="mt-5">
      <AuthWrapper
        authType="login"
        disabled={isSubmitting}
        onSuccess={props.onSuccess}
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <VerticalStack>
            <Input
              control={form.control}
              name="usernameOrEmail"
              label="Username or email"
              type="text"
              fullWidth
              autoFocus={isDesktop}
            />
            <Input
              control={form.control}
              name="password"
              label="Password"
              autoComplete="current-password"
              fullWidth
              type="password"
              endAccessory="passwordVisibility"
            />
            <HorizontalStack addClassName="items-center justify-between">
              <Checkbox
                control={form.control}
                name="rememberMe"
                label="Remember me"
              />
              <Button
                variant="text"
                type="button"
                size="large"
                disabled={isSubmitting}
                onClick={props.onForgotPasswordClick}
              >
                Forgot password?
              </Button>
            </HorizontalStack>
            <Button
              variant="contained"
              type="submit"
              size="large"
              isLoading={isSubmitting}
            >
              Log In
            </Button>
          </VerticalStack>
        </form>
      </AuthWrapper>
    </Section>
  );
};

export default Login;
