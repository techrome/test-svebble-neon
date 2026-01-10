import React from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paper, Typography } from "@mui/material";
import z from "zod";

import {
  defaultPadding,
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import { Text } from "@/utils/validators/helpers/text";
import useAuthedUser from "@/trpc/hooks/useAuthedUser";
import { RouterOutput, trpc } from "@/trpc";
import Input from "@/components/Fields/Input";
import Button from "@/components/Button/Button";
import { useAppSnackbar } from "@/utils/snackbar";
import Image from "next/image";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ButtonBase from "@/components/Button/ButtonBase";
import { signupSchemaForm } from "@/utils/validators/shared/auth";
import { UsernameInput } from "@/components/AuthForm/Signup";
import avatarPlaceholderSrc from "@@/public/images/user-placeholder.webp";

const SectionWrapper = (props: { children: React.ReactNode }) => {
  return (
    <Paper
      elevation={3}
      className={`${defaultPadding} rounded-lg border border-[var(--mui-palette-divider)]`}
    >
      {props.children}
    </Paper>
  );
};

const DISPLAY_NAME_ALLOWED_REGEX = /^[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u;
const DISPLAY_NAME_FORBIDDEN_REGEX = /[\r\n\t<>]|\p{C}/u;

export const basicProfileSchemaForm = z.object({
  name: Text.Handle({ required: true }).superRefine((value, ctx) => {
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
  const basicInfoUpdateMutation = trpc.auth.updateUserBasicInfo.useMutation({
    async onSuccess() {
      await utils.auth.user.invalidate();
      addAppSnackbar({
        message: "Profile updated.",
        variant: "success",
      });
    },
  });

  const onSubmit: SubmitHandler<BasicProfileFormValues> = async (values) => {
    basicInfoUpdateMutation.mutate(values);
  };

  const isSubmitting = basicInfoUpdateMutation.isPending;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Typography variant="h6" component="h2" className="mb-2">
        Basic information
      </Typography>
      <VerticalStack>
        <div className="mb-2">
          <HorizontalStack addClassName="items-center">
            <div className="group relative w-full max-w-32 h-32 rounded-full border-4 border-[var(--mui-palette-text-secondary)]">
              <Image
                className="rounded-full "
                src={user.image || avatarPlaceholderSrc}
                alt="user-avatar"
                fill
                sizes="128px"
              />
              <ButtonBase
                focusRipple
                className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 bg-[rgb(var(--mui-palette-background-defaultChannel)/0.6)] text-[var(--mui-palette-text-primary)] transition absolute inset-0 rounded-full flex justify-center items-center"
              >
                <EditIcon />
              </ButtonBase>
            </div>
            <div>
              <VerticalStack>
                <Button
                  variant="contained"
                  color="inherit"
                  startIcon={<EditIcon />}
                >
                  Change avatar
                </Button>
                {Boolean(user.image) && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                  >
                    Remove avatar
                  </Button>
                )}
              </VerticalStack>
            </div>
          </HorizontalStack>
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

export const usernameSchemaForm = z.object({
  username: signupSchemaForm.shape.username,
});

type User = NonNullable<RouterOutput["auth"]["user"]["user"]>;

const makeUsernameSchemaForm = (currentUsername: User["username"]) =>
  usernameSchemaForm.superRefine(({ username }, ctx) => {
    if (username.toLowerCase() === String(currentUsername).toLowerCase()) {
      ctx.addIssue({
        code: "custom",
        path: ["username"],
        message: "New username must be different than your current username.",
      });
    }
  });

export type UsernameFormValues = z.infer<typeof usernameSchemaForm>;

const UsernameForm = () => {
  const user = useAuthedUser();
  const schema = React.useMemo(
    () => makeUsernameSchemaForm(user.username),
    [user.username]
  );
  const form = useForm<UsernameFormValues>({
    defaultValues: { username: user.displayUsername || undefined },
    resolver: zodResolver(schema),
    context: { user },
  });
  const { addAppSnackbar } = useAppSnackbar();
  const utils = trpc.useUtils();
  const usernameUpdateMutation = trpc.auth.updateUserUsername.useMutation({
    async onSuccess() {
      await utils.auth.user.invalidate();
      addAppSnackbar({
        message: "Username successfully updated.",
        variant: "success",
      });
    },
  });

  const onSubmit: SubmitHandler<UsernameFormValues> = async (values) => {
    const usernameError = form.formState.errors.username;
    if (usernameError) {
      form.setError("username", { ...usernameError }, { shouldFocus: true });
      return;
    }
    usernameUpdateMutation.mutate(values);
  };

  const remainingChanges = user.remainingUsernameChanges;
  const isSubmitting = usernameUpdateMutation.isPending;
  const isDisabled =
    typeof remainingChanges === "number" ? remainingChanges < 1 : true;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Typography variant="h6" component="h2" className="mb-2">
        Username
      </Typography>
      <VerticalStack>
        <Typography
          variant="subtitle2"
          color={isDisabled ? "warning" : "success"}
        >
          {typeof remainingChanges === "number" ? (
            remainingChanges > 0 ? (
              <>
                Username can be changed <strong>{remainingChanges} </strong>
                time(s).
              </>
            ) : (
              `Username cannot be changed anymore.`
            )
          ) : (
            "Changing username is not available."
          )}
        </Typography>
        <UsernameInput form={form} disabled={isDisabled} />
        <Button
          variant="contained"
          type="submit"
          size="large"
          isLoading={isSubmitting}
          disabled={isDisabled}
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
        <VerticalStack spacing="md">
          <Typography variant="h4" component="h1">
            My Profile
          </Typography>
          <SectionWrapper>
            <ProfileForm />
          </SectionWrapper>
          <SectionWrapper>
            <UsernameForm />
          </SectionWrapper>
        </VerticalStack>
      </div>
    </Section>
  );
};

export default MyProfile;
