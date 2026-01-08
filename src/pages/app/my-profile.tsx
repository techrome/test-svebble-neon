import React from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Typography } from "@mui/material";
import z from "zod";

import { Section, VerticalStack } from "@/components/Layout/Containers";
import { Text } from "@/utils/validators/helpers/text";
import useAuthedUser from "@/trpc/hooks/useAuthedUser";
import { trpc } from "@/trpc";
import Input from "@/components/Fields/Input";
import Button from "@/components/Button/Button";
import { useAppSnackbar } from "@/utils/snackbar";
import Label from "@/components/Label/Label";

const DISPLAY_NAME_ALLOWED_REGEX = /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u;
const DISPLAY_NAME_FORBIDDEN_REGEX = /[\r\n\t<>]|\p{C}/u;

export const basicProfileSchemaForm = z.object({
  name: Text.Handle()
    .min(3)
    .superRefine((value, ctx) => {
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

type BasicProfileFormValues = z.infer<typeof basicProfileSchemaForm>;

const ProfileForm = () => {
  const user = useAuthedUser();
  const form = useForm<BasicProfileFormValues>({
    defaultValues: { name: user.name },
    resolver: zodResolver(basicProfileSchemaForm),
  });
  const { addAppSnackbar } = useAppSnackbar();
  const utils = trpc.useUtils();
  const userUpdateMutation = trpc.auth.updateUser.useMutation({
    async onSuccess() {
      await utils.auth.user.invalidate();
      addAppSnackbar({
        message: "Profile updated.",
        variant: "success",
      });
    },
  });

  const onSubmit: SubmitHandler<BasicProfileFormValues> = async (values) => {
    userUpdateMutation.mutate(values);
  };

  const isSubmitting = userUpdateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <VerticalStack>
        <div>
          <Label>Avatar</Label>
          <div className="w-full max-w-32 h-32 rounded-full bg-[var(--mui-palette-text-primary)] mb-2"></div>
        </div>
        <Input
          control={form.control}
          name="name"
          label="Display Name"
          type="text"
          fullWidth
          helperText="Can be changed anytime. Doesn't have to be unique."
        />
        <Button
          variant="contained"
          type="submit"
          size="large"
          isLoading={isSubmitting}
        >
          Save
        </Button>
      </VerticalStack>
    </form>
  );
};

const MyProfile = () => {
  return (
    <Section addClassName="flex justify-center">
      <div className="max-w-2xl w-full">
        <VerticalStack>
          <Typography variant="h4" component="h1">
            My Profile
          </Typography>
          <ProfileForm />
        </VerticalStack>
      </div>
    </Section>
  );
};

export default MyProfile;
