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

type Props = {
  onSubmit?: () => void;
};

type FormValues = z.infer<typeof loginSchemaForm>;

const emptyFormValues: FormValues = {
  username: "",
  password: "",
  rememberMe: false,
};

const Login = (props: Props) => {
  const form = useForm<FormValues>({
    defaultValues: emptyFormValues,
    resolver: zodResolver(loginSchemaForm),
  });

  const { addAppSnackbar } = useAppSnackbar();

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    console.log({ values });
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Section addClassName="mt-5">
      <AuthWrapper
        authType="login"
        isLoading={isSubmitting}
        onGoogleClick={() => {}}
        onGuestClick={() => {}}
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <VerticalStack>
            <Input
              control={form.control}
              name="username"
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
            <Button variant="contained" type="submit" size="large">
              Log In
            </Button>
          </VerticalStack>
        </form>
      </AuthWrapper>
    </Section>
  );
};

export default Login;
