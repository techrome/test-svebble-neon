import React from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Chip, CircularProgress, Paper, Typography } from "@mui/material";
import NextImage from "next/image";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import MailIcon from "@mui/icons-material/Mail";
import LockIcon from "@mui/icons-material/Lock";
import { Dayjs } from "dayjs";

import {
  defaultPadding,
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import { useAuthedUserData } from "@/trpc/hooks/useUser";
import { trpc } from "@/trpc";
import Input from "@/components/Fields/Input";
import Button from "@/components/Button/Button";
import { useAppSnackbar } from "@/utils/snackbar";
import ButtonBase from "@/components/Button/ButtonBase";
import {
  PasswordStrengthMeter,
  UsernameInput,
} from "@/components/AuthForm/Signup";
import { useGlobalModal, useLocalModal } from "@/utils/hooks/useOverlay";
import Confirm from "@/components/Modals/Confirm/Confirm";
import { CACHE_TIME, minutes, seconds } from "@/utils/cacheTime";
import { PROVIDER_IDS } from "@/utils/constants";
import { isPlaceholderEmail } from "@/trpc/helpers/email";
import { useFreshUser } from "@/trpc/hooks/useFreshUser";
import LoadingBoundary from "@/components/LoadingBoundary/LoadingBoundary";
import dayjs from "@/utils/dayjs";
import { useCooldown } from "@/utils/hooks/useCooldown";
import {
  BroadcastChannelEvent,
  BroadcastChannels,
} from "@/pages/app/email-verified";
import Tooltip from "@/components/Tooltip/Tooltip";
import { env } from "@/utils/env";
import {
  avatarUploadUrlSchema,
  AvatarUploadUrlSchemaForm,
  BasicProfileFormValues,
  basicProfileSchemaForm,
  makeUsernameSchemaForm,
  UsernameFormValues,
  PasswordFormValues,
  makePasswordSchemaForm,
  makeEmailChangeSchemaForm,
  EmailFormValues,
} from "@/utils/validators/shared/user";
import AvatarChangeModal from "@/components/Modals/AvatarEdit/AvatarEdit";

export const defaultAvatars = {
  first: `default-avatars/1.webp`,
};

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

export const createImage = async (file: File): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image failed to load"));

      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

const BasicProfileForm = () => {
  const userData = useAuthedUserData();
  const form = useForm<BasicProfileFormValues>({
    defaultValues: { name: userData.name },
    resolver: zodResolver(basicProfileSchemaForm),
  });
  const nameIsDirty = form.formState.dirtyFields.name;
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarWasChanged, setAvatarWasChanged] =
    React.useState<boolean>(false);

  const { addAppSnackbar } = useAppSnackbar();
  const avatarEditModal = useLocalModal();
  const utils = trpc.useUtils();
  const basicInfoUpdateMutation = trpc.user.updateUserBasicInfo.useMutation();
  const createAvatarUploadUrlMutation =
    trpc.user.createAvatarUploadUrl.useMutation();

  const validateAvatarFile = async (file: File | null) => {
    if (!file) {
      addAppSnackbar({
        message: "No image selected",
        variant: "error",
      });
      return null;
    }
    const imageInfo = await createImage(file);
    const parseResult = avatarUploadUrlSchema.safeParse({
      imageSize: file.size,
      imageType: file.type,
      imageWidth: imageInfo.naturalWidth,
      imageHeight: imageInfo.naturalHeight,
    } satisfies Record<keyof AvatarUploadUrlSchemaForm, unknown>);

    if (!parseResult.success) {
      addAppSnackbar({
        message: parseResult.error?.issues?.[0].message,
        variant: "error",
      });
      return null;
    }

    return parseResult;
  };

  const handleCreateAvatarUploadUrl = async () => {
    const parseResult = await validateAvatarFile(avatarFile);
    if (!parseResult) return;
    const data = await createAvatarUploadUrlMutation.mutateAsync(
      parseResult.data
    );
    try {
      const res = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: data.requiredHeaders,
        body: avatarFile,
      });
      if (!res.ok) throw new Error();
      return data.bucketKey;
    } catch {
      addAppSnackbar({
        message: "Failed to upload the image",
        variant: "error",
      });
      throw new Error();
    }
  };

  const resetAvatarState = () => {
    setAvatarFile(null);
    setAvatarWasChanged(false);
  };

  const onSubmit: SubmitHandler<BasicProfileFormValues> = async (values) => {
    try {
      if (!nameIsDirty && !avatarWasChanged) {
        addAppSnackbar({
          message: "Profile is already up to date",
        });
        return;
      }

      let avatarBucketKey = undefined;
      if (avatarWasChanged) {
        if (avatarFile) {
          avatarBucketKey = await handleCreateAvatarUploadUrl();
        } else {
          avatarBucketKey = null;
        }
      }

      await basicInfoUpdateMutation.mutateAsync({
        ...values,
        ...(avatarBucketKey !== undefined ? { image: avatarBucketKey } : {}),
      });

      await utils.auth.user.invalidate();
      addAppSnackbar({
        message: "Profile updated",
        variant: "success",
      });
      form.reset({
        name: values.name,
      });
      resetAvatarState();
    } catch {}
  };

  const avatarFileSrc = React.useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : ""),
    [avatarFile]
  );
  React.useEffect(() => {
    return () => URL.revokeObjectURL(avatarFileSrc);
  }, [avatarFileSrc]);

  const isSubmitting = form.formState.isSubmitting;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Typography variant="h6" component="h2" className="mb-2">
        <PersonIcon className="align-sub" /> Basic information
      </Typography>
      <VerticalStack>
        <div className="mb-2">
          <HorizontalStack addClassName="items-center">
            <div className="group relative w-full max-w-32 h-32 rounded-full border border-[var(--mui-palette-text-secondary)]">
              <NextImage
                className="rounded-full"
                src={
                  avatarWasChanged
                    ? avatarFileSrc ||
                      `${env.NEXT_PUBLIC_CDN_URL}/${defaultAvatars.first}`
                    : `${env.NEXT_PUBLIC_CDN_URL}/${userData.image || defaultAvatars.first}`
                }
                alt="user-avatar"
                fill
                unoptimized
              />
              <ButtonBase
                focusRipple
                className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 bg-[rgb(var(--mui-palette-background-defaultChannel)/0.6)] text-[var(--mui-palette-text-primary)] transition absolute inset-0 rounded-full flex justify-center items-center"
                type="button"
                onClick={avatarEditModal.openModal}
              >
                <EditIcon />
              </ButtonBase>
            </div>
            <div>
              <VerticalStack>
                <Button
                  variant="contained"
                  color="inherit"
                  type="button"
                  startIcon={<EditIcon />}
                  onClick={avatarEditModal.openModal}
                >
                  Change avatar
                </Button>
                {Boolean(avatarWasChanged ? avatarFileSrc : userData.image) && (
                  <Button
                    variant="outlined"
                    color="error"
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarWasChanged(true);
                    }}
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
        <avatarEditModal.ReadyComponent
          title="Select Image"
          dialogProps={{ disableRestoreFocus: true }}
        >
          <AvatarChangeModal
            onConfirm={(file) => {
              setAvatarFile(file);
              setAvatarWasChanged(true);
              avatarEditModal.closeModal();
            }}
          />
        </avatarEditModal.ReadyComponent>
      </VerticalStack>
    </form>
  );
};

const UsernameForm = () => {
  const userData = useAuthedUserData();
  const schema = React.useMemo(
    () => makeUsernameSchemaForm(userData.username),
    [userData.username]
  );
  const form = useForm<UsernameFormValues>({
    defaultValues: { username: userData.displayUsername || undefined },
    resolver: zodResolver(schema),
  });
  const { addAppSnackbar } = useAppSnackbar();
  const { openModal, closeModal } = useGlobalModal();
  const utils = trpc.useUtils();
  const usernameUpdateMutation = trpc.user.updateUserUsername.useMutation({
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

  const remainingChanges = userData.remainingUsernameChanges;
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

  const passwordUpdateMutation = trpc.user.changeUserPassword.useMutation({
    async onSuccess() {
      await utils.auth.user.invalidate();
      await utils.user.listUserAccounts.invalidate();
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
            ? "Change your password here."
            : `Set a password to be able to log in with credentials.`}
        </Typography>
        {hasOldPassword && (
          <Input
            control={form.control}
            name="oldPassword"
            label="Current password"
            fullWidth
            type="password"
            autoComplete="current-password"
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
          Save
        </Button>
      </VerticalStack>
    </form>
  );
};

const PasswordFormWrapper = () => {
  const userData = useAuthedUserData();
  const userAccounts = trpc.user.listUserAccounts.useQuery(
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

const EmailForm = () => {
  const pollingStartedTime = React.useRef<Dayjs | null>(null);
  useFreshUser(
    {
      refetchInterval: (data) => {
        const shouldStartPolling = Boolean(
          data?.state.data?.user?.pendingEmail
        );

        if (!shouldStartPolling) {
          pollingStartedTime.current = null;
          return false;
        }

        if (!pollingStartedTime.current) {
          pollingStartedTime.current = dayjs();
          return seconds(30);
        }

        const elapsedMs = Math.abs(
          dayjs().diff(pollingStartedTime.current, "milliseconds", true)
        );

        // making polling less frequent if it takes too long not to spam the server
        if (elapsedMs < minutes(1)) {
          return seconds(30);
        }
        if (elapsedMs < minutes(2)) {
          return seconds(60);
        }
        if (elapsedMs < minutes(5)) {
          return seconds(120);
        }

        return minutes(5);
      },
    },
    { disableLoadingBoundary: true }
  );
  const freshUserData = useAuthedUserData();

  const schema = React.useMemo(() => {
    return makeEmailChangeSchemaForm(freshUserData.email);
  }, [freshUserData.email]);
  const form = useForm<EmailFormValues>({
    defaultValues: { email: "" },
    resolver: zodResolver(schema),
  });

  const resendTimer = useCooldown(minutes(2));
  const { addAppSnackbar } = useAppSnackbar();

  const utils = trpc.useUtils();
  const emailUpdateMutation = trpc.user.changeEmail.useMutation({
    meta: { keepDefaultErrorHandling: true },
    async onSuccess(_data, variables) {
      await utils.auth.freshUser.invalidate();
      addAppSnackbar({
        message: (
          <>
            Verification email sent to <strong>{variables.email}</strong>. If
            you don’t see this email in your inbox within 15 minutes, look for
            it in your spam mail folder.
          </>
        ),
        variant: "info",
        durationMs: 0,
      });
      form.reset();
      resendTimer.start();
    },
    onError() {
      resendTimer.reset();
    },
  });
  const cancelPendingEmailMutation = trpc.user.cancelPendingEmail.useMutation({
    async onSuccess() {
      await utils.auth.freshUser.invalidate();
    },
  });

  const onSubmit: SubmitHandler<EmailFormValues> = (values) => {
    emailUpdateMutation.mutate(values);
  };

  const anySubmitting =
    emailUpdateMutation.isPending || cancelPendingEmailMutation.isPending;
  const anyEmail = !isPlaceholderEmail(freshUserData.email)
    ? freshUserData.email
    : freshUserData.pendingEmail;

  React.useEffect(() => {
    const bc = new BroadcastChannel("auth-events" satisfies BroadcastChannels);
    bc.onmessage = (event: MessageEvent<BroadcastChannelEvent>) => {
      if (event.data === "email-verified") {
        utils.auth.freshUser.invalidate();
      }
    };
    return () => {
      bc.close();
    };
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <HorizontalStack addClassName="mb-3">
        <Typography variant="h6" component="h2">
          <MailIcon className="align-sub" /> Email
        </Typography>
      </HorizontalStack>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <VerticalStack>
          {!anyEmail ? (
            <Typography variant="subtitle2">
              Add an email so you can recover your account if you forget your
              password.
            </Typography>
          ) : anyEmail ? (
            <VerticalStack>
              {Boolean(freshUserData.email) &&
                !isPlaceholderEmail(freshUserData.email) && (
                  <HorizontalStack addClassName="items-center">
                    <Typography variant="subtitle2">
                      Active email: <strong>{freshUserData.email}</strong>
                    </Typography>
                    <Chip
                      className="w-fit"
                      label={"Verified"}
                      variant={"outlined"}
                      color={"success"}
                    />
                  </HorizontalStack>
                )}
              {Boolean(freshUserData.pendingEmail) && (
                <>
                  <HorizontalStack addClassName="items-center">
                    <Typography variant="subtitle2">
                      Pending email:{" "}
                      <strong>{freshUserData.pendingEmail}</strong>
                    </Typography>
                    <Chip
                      className="w-fit"
                      label={"Not verified"}
                      variant={"outlined"}
                      color={"warning"}
                    />
                  </HorizontalStack>
                  <HorizontalStack addClassName="items-center">
                    <div className="flex items-center">
                      <span className="mr-1 h-1.5 w-1.5 rounded-full animate-pulse bg-[var(--mui-palette-warning-main)]" />
                      <Typography variant="subtitle2">
                        Waiting for email confirmation...
                      </Typography>
                    </div>
                    <Tooltip
                      title={
                        resendTimer.isCoolingDown
                          ? `You can resend the link in ${resendTimer.remainingSeconds} seconds.`
                          : ""
                      }
                    >
                      <Button
                        variant="contained"
                        color="primary"
                        type="button"
                        onClick={() => {
                          if (freshUserData.pendingEmail) {
                            emailUpdateMutation.mutate({
                              email: freshUserData.pendingEmail,
                            });
                          }
                        }}
                        isLoading={emailUpdateMutation.isPending}
                        disabled={anySubmitting || resendTimer.isCoolingDown}
                        className={
                          resendTimer.isCoolingDown ? "normal-case" : ""
                        }
                        endIcon={
                          resendTimer.isCoolingDown && (
                            <CircularProgress
                              size={20}
                              variant="determinate"
                              value={resendTimer.progress}
                              enableTrackSlot
                            />
                          )
                        }
                      >
                        {resendTimer.isCoolingDown
                          ? `${resendTimer.remainingSeconds}s`
                          : "Resend link"}
                      </Button>
                    </Tooltip>
                    <Tooltip title="Cancel and use a different email.">
                      <Button
                        variant="contained"
                        color="inherit"
                        type="button"
                        onClick={() => {
                          cancelPendingEmailMutation.mutate();
                        }}
                        isLoading={cancelPendingEmailMutation.isPending}
                        disabled={anySubmitting}
                      >
                        Cancel
                      </Button>
                    </Tooltip>
                  </HorizontalStack>
                </>
              )}
            </VerticalStack>
          ) : null}
          {!freshUserData.pendingEmail && (
            <>
              <Input
                control={form.control}
                name="email"
                label="New email"
                type="email"
                autoComplete="email"
                fullWidth
                helperText={
                  anyEmail
                    ? "We’ll send a verification link to this address. Your current email stays active until you verify the new one."
                    : "We’ll send a verification link to this address. Verify this email to finish setting up your account."
                }
              />
              <Tooltip
                title={
                  resendTimer.isCoolingDown
                    ? `You can send the link in ${resendTimer.remainingSeconds} seconds.`
                    : ""
                }
              >
                <Button
                  variant="contained"
                  type="submit"
                  size="large"
                  fullWidth
                  isLoading={emailUpdateMutation.isPending}
                  disabled={anySubmitting || resendTimer.isCoolingDown}
                  className={resendTimer.isCoolingDown ? "normal-case" : ""}
                  endIcon={
                    resendTimer.isCoolingDown && (
                      <CircularProgress
                        size={20}
                        variant="determinate"
                        value={resendTimer.progress}
                        enableTrackSlot
                      />
                    )
                  }
                >
                  {resendTimer.isCoolingDown
                    ? `${resendTimer.remainingSeconds}s`
                    : "Send verification link"}
                </Button>
              </Tooltip>
            </>
          )}
        </VerticalStack>
      </form>
    </>
  );
};

const EmailFormWrapper = () => {
  const freshUser = useFreshUser(undefined, {
    disableLoadingBoundary: true,
  });

  if (freshUser.isPending) {
    return (
      <div className="w-full flex justify-center items-center">
        <CircularProgress />
      </div>
    );
  }

  if (freshUser.error || !freshUser.data?.user) {
    return (
      <div className="w-full flex justify-center items-center">
        <Typography>Error fetching user data.</Typography>
      </div>
    );
  }

  return <EmailForm />;
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
          <LoadingBoundary>
            <SectionWrapper>
              <EmailFormWrapper />
            </SectionWrapper>
          </LoadingBoundary>
        </VerticalStack>
      </div>
    </Section>
  );
};

export default MyProfile;
