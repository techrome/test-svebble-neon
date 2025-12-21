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

type Props = {
  onSubmit?: () => void;
};

const schemaForm = z.object({
  username: Text.Handle({ required: true }),
  password: Text.Title({ shouldTrim: false, required: true }),
  rememberMe: z.boolean(),
});

type FormValues = z.infer<typeof schemaForm>;

const emptyFormValues: FormValues = {
  username: "",
  password: "",
  rememberMe: false,
};

const Login = (props: Props) => {
  const form = useForm<FormValues>({
    defaultValues: emptyFormValues,
    resolver: zodResolver(schemaForm),
  });

  const { addAppSnackbar } = useAppSnackbar();

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    console.log({ values });
  };

  return (
    <Section addClassName="mt-5">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <VerticalStack>
          <Input
            control={form.control}
            name="username"
            label="Username"
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
    </Section>
  );
};

export default Login;
