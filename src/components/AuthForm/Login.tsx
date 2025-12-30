import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import z from "zod";

import { useAppSnackbar } from "@/utils/snackbar";
import { Text } from "@/utils/validators/helpers/text";
import { Section, VerticalStack } from "@/components/Layout/Containers";
import Button from "@/components/Button/Button";
import Checkbox from "@/components/Fields/Checkbox";
import Input from "@/components/Fields/Input";
import { loginSchemaForm } from "@/utils/validators/shared/auth";
import { AuthWrapper } from "@/components/AuthForm/Helpers";
import { trpc } from "@/trpc";
import { useAppDispatch } from "@/redux/hooks";
import { eventHappened } from "@/redux/slices/misc";

type Props = {
  onSuccess?: () => void;
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

  const { addAppSnackbar } = useAppSnackbar();
  const dispatch = useAppDispatch();
  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.loginCredentials.useMutation({
    onSuccess(data) {
      if (data?.user) {
        utils.auth.user.setData(undefined, {
          user: {
            isAnonymous: false,
            ...data.user,
          },
        });
        utils.auth.user.invalidate();
      }
      dispatch(eventHappened("hasLoggedIn"));
      props.onSuccess?.();
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    loginMutation.mutate(values);
  };

  const isSubmitting = loginMutation.isPending;

  return (
    <Section addClassName="mt-5">
      <AuthWrapper authType="login" disabled={isSubmitting}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <VerticalStack>
            <Input
              control={form.control}
              name="usernameOrEmail"
              label="Username or email"
              type="text"
              fullWidth
              autoFocus
            />
            <Input
              control={form.control}
              name="password"
              label="Password"
              fullWidth
              type="password"
              endAccessory="passwordVisibility"
            />
            <Checkbox
              control={form.control}
              name="rememberMe"
              label="Remember me"
            />
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
