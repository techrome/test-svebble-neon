import React from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Chip, CircularProgress, Paper, Typography } from "@mui/material";
import z from "zod";
import Image from "next/image";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AccountCircleIcon from "@mui/icons-material/Person";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import LockIcon from "@mui/icons-material/Lock";

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
import ButtonBase from "@/components/Button/ButtonBase";
import { signupSchemaForm } from "@/utils/validators/shared/auth";
import {
  PasswordStrengthMeter,
  UsernameInput,
} from "@/components/AuthForm/Signup";
import avatarPlaceholderSrc from "@@/public/images/user-placeholder.webp";
import { useGlobalModal } from "@/utils/hooks/useOverlay";
import Confirm from "@/components/ModalTemplates/Confirm";
import { CACHE_TIME } from "@/utils/cacheTime";
import { PROVIDER_IDS } from "@/utils/constants";

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

const BasicProfileForm = () => {
  const userData = useAuthedUser();
  const form = useForm<BasicProfileFormValues>({
    defaultValues: { name: userData.name },
    resolver: zodResolver(basicProfileSchemaForm),
  });
  const { addAppSnackbar } = useAppSnackbar();
  const utils = trpc.useUtils();
  const basicInfoUpdateMutation = trpc.auth.updateUserBasicInfo.useMutation({
    async onSuccess() {
      await utils.auth.user.invalidate();
      addAppSnackbar({
        message: "Profile updated",
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
        <AccountCircleIcon className="align-sub" /> Basic information
      </Typography>
      <VerticalStack>
        <div className="mb-2">
          <HorizontalStack addClassName="items-center">
            <div className="group relative w-full max-w-32 h-32 rounded-full border-4 border-[var(--mui-palette-text-secondary)]">
              <Image
                className="rounded-full "
                src={userData.image || avatarPlaceholderSrc}
                alt="user-avatar"
                fill
                sizes="128px"
                quality={100}
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
                {Boolean(userData.image) && (
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
  });
  const { addAppSnackbar } = useAppSnackbar();
  const { openModal, closeModal } = useGlobalModal();
  const utils = trpc.useUtils();
  const usernameUpdateMutation = trpc.auth.updateUserUsername.useMutation({
    async onSuccess() {
      await utils.auth.user.invalidate();
      addAppSnackbar({
        message: "Username successfully updated",
        variant: "success",
      });
    },
  });

  const onConfirmSubmit = async (values: UsernameFormValues) => {
    closeModal();
    usernameUpdateMutation.mutate(values);
  };

  const onSubmit: SubmitHandler<UsernameFormValues> = (values) => {
    const usernameError = form.formState.errors.username;
    if (usernameError) {
      form.setError("username", { ...usernameError }, { shouldFocus: true });
      return;
    }
    openModal({
      content: (
        <Confirm
          message={
            <div className="text-center">
              Your new username will be: <br />
              <strong>{values.username}</strong>
              <br />
              Do you want to proceed?
            </div>
          }
          onCancel={closeModal}
          onConfirm={() => {
            onConfirmSubmit(values);
          }}
        />
      ),
      props: {
        title: "Username change confirmation",
      },
    });
  };

  const remainingChanges = user.remainingUsernameChanges;
  const isSubmitting = usernameUpdateMutation.isPending;
  const isDisabled =
    typeof remainingChanges === "number" ? remainingChanges < 1 : true;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <HorizontalStack addClassName="mb-3">
        <Typography variant="h6" component="h2">
          <AlternateEmailIcon className="align-sub" /> Username
        </Typography>
        <Chip
          className="w-fit"
          label={
            typeof remainingChanges === "number" ? (
              remainingChanges > 0 ? (
                <>
                  Can be changed <strong>{remainingChanges} </strong>
                  time{remainingChanges > 1 && "s"}
                </>
              ) : (
                `Cannot be changed anymore`
              )
            ) : (
              "Changing username is not available"
            )
          }
          variant={isDisabled ? "filled" : "outlined"}
          color={isDisabled ? "default" : "success"}
        />
      </HorizontalStack>
      <VerticalStack>
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

export const basePasswordSchemaForm = z
  .object({
    password: signupSchemaForm.shape.password,
    passwordConfirm: signupSchemaForm.shape.password,
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirm) {
      ctx.addIssue({
        code: "custom",
        message: "New passwords do not match.",
        path: ["passwordConfirm"],
      });
    }
  });

export const passwordSchemaForm = basePasswordSchemaForm.safeExtend({
  oldPassword: signupSchemaForm.shape.password.or(z.literal("")),
});

export const makePasswordSchemaForm = (hasOldPassword: boolean) => {
  if (hasOldPassword) {
    return passwordSchemaForm
      .safeExtend({
        oldPassword: passwordSchemaForm.shape.password,
      })
      .superRefine((data, ctx) => {
        if (data.oldPassword === data.password) {
          ctx.addIssue({
            code: "custom",
            message:
              "New password must be different than the current password.",
            path: ["password"],
          });
        }
      });
  } else {
    return passwordSchemaForm;
  }
};

type PasswordFormValues = z.infer<typeof passwordSchemaForm>;

const emptyPasswordFormValues: PasswordFormValues = {
  oldPassword: "",
  password: "",
  passwordConfirm: "",
};

const PasswordForm = ({ hasOldPassword }: { hasOldPassword: boolean }) => {
  const [passwordFieldWasFocused, setPasswordFieldWasFocused] =
    React.useState(false);

  const schema = React.useMemo(
    () => makePasswordSchemaForm(hasOldPassword),
    [hasOldPassword]
  );
  const form = useForm<PasswordFormValues>({
    defaultValues: emptyPasswordFormValues,
    resolver: zodResolver(schema),
  });

  const { addAppSnackbar } = useAppSnackbar();
  const utils = trpc.useUtils();

  const passwordUpdateMutation = trpc.auth.changeUserPassword.useMutation({
    async onSuccess() {
      await utils.auth.user.invalidate();
      await utils.auth.listUserAccounts.invalidate();
      addAppSnackbar({
        message: "Password updated",
        variant: "success",
      });
      form.reset(emptyPasswordFormValues, { keepDefaultValues: true });
      setPasswordFieldWasFocused(false);
    },
  });

  const onSubmit: SubmitHandler<PasswordFormValues> = async (values) => {
    passwordUpdateMutation.mutate(values);
  };

  const isSubmitting = passwordUpdateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Typography variant="h6" component="h2" className="mb-2">
        <LockIcon className="align-sub" /> Password
      </Typography>
      <VerticalStack>
        <Typography variant="subtitle2">
          {hasOldPassword
            ? "You can change your password here."
            : `You can set a password to be able to log in with credentials.`}
        </Typography>
        {hasOldPassword && (
          <Input
            control={form.control}
            name="oldPassword"
            label="Current password"
            fullWidth
            type="password"
            endAccessory="passwordVisibility"
          />
        )}
        <div>
          <Input
            control={form.control}
            name="password"
            label="New password"
            fullWidth
            type="password"
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
          endAccessory="passwordVisibility"
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

const PasswordFormWrapper = () => {
  const userData = useAuthedUser();
  const userAccounts = trpc.auth.listUserAccounts.useQuery(
    { id: userData.id },
    {
      staleTime: CACHE_TIME.NORMAL,
    }
  );

  if (userAccounts.isPending) {
    return (
      <div className="w-full flex justify-center items-center">
        <CircularProgress />
      </div>
    );
  }

  if (userAccounts.error || !userAccounts.data?.length) {
    return (
      <div className="w-full flex justify-center items-center">
        <Typography>No user accounts found.</Typography>
      </div>
    );
  }

  const hasOldPassword = userAccounts.data.some(
    (account) => account.providerId === PROVIDER_IDS.credential
  );

  return <PasswordForm hasOldPassword={hasOldPassword} />;
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
            <BasicProfileForm />
          </SectionWrapper>
          <SectionWrapper>
            <UsernameForm />
          </SectionWrapper>
          <SectionWrapper>
            <PasswordFormWrapper />
          </SectionWrapper>
        </VerticalStack>
      </div>
    </Section>
  );
};

export default MyProfile;
