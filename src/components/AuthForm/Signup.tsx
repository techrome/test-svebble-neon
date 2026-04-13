import React, { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FieldPath,
  FieldValues,
  SubmitHandler,
  useForm,
  UseFormReturn,
  useWatch,
} from "react-hook-form";
import z from "@/utils/zod";
import ErrorIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RemoveCircleIcon from "@mui/icons-material/RemoveCircleOutline";
import {
  CircularProgress,
  LinearProgress,
  Typography,
  TypographyProps,
} from "@mui/material";

import Button from "@/components/Button/Button";
import Input from "@/components/Fields/Input";
import {
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import { useAppSnackbar } from "@/utils/snackbar";
import Collapse from "@/components/Collapse/Collapse";
import {
  passwordMinLength,
  signupSchemaForm,
} from "@/utils/validators/shared/auth";
import { trpc } from "@/trpc";
import { AuthWrapper } from "@/components/AuthForm/Helpers";
import { CACHE_TIME_MS } from "@/utils/cacheTime";
import { useDebouncedValue } from "@/utils/hooks/useDebouncedValue";
import { normalizeText } from "@/utils/stringUtils";
import Tooltip from "@/components/Tooltip/Tooltip";
import useAppQuery from "@/utils/hooks/useAppQuery";
import { useUser } from "@/trpc/hooks/useUser";
import useIsDesktop from "@/utils/hooks/useIsDesktop";
import { userLoginLifecycle } from "@/trpc/helpers/userLifecycle";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  onSuccess?: () => void;
  guestHidden?: boolean;
};

type PasswordRule = {
  label: string;
  error?: string;
  validate: (v: string) => boolean;
  required?: boolean;
  score: number;
  hidden?: boolean;
};

export const requiredPasswordRules: PasswordRule[] = [
  {
    label: "At least 8 characters",
    error: "Password must have at least 8 characters",
    validate: (value) => value.length >= passwordMinLength,
    required: true,
    score: 1,
  },
];

const passwordRules: PasswordRule[] = [
  ...requiredPasswordRules,
  {
    label: "At least 12 characters",
    validate: (value) => value.length >= 12,
    score: 2,
    hidden: true,
  },
  {
    label: "At least 16 characters",
    validate: (value) => value.length >= 16,
    score: 2,
    hidden: true,
  },
  {
    label: "At least 20 characters",
    validate: (value) => value.length >= 20,
    score: 3,
    hidden: true,
  },
  {
    label: "At least 24 characters",
    validate: (value) => value.length >= 24,
    score: 2,
    hidden: true,
  },
  {
    label: "At least 28 characters",
    validate: (value) => value.length >= 28,
    score: 2,
    hidden: true,
  },
  {
    label: "A repeated character 3 times (penalty)",
    validate: (value) => /(.)\1\1/.test(value),
    score: -2,
    hidden: true,
  },
  {
    label: "A repeated character 4 times (penalty)",
    validate: (value) => /(.)\1\1\1/.test(value),
    score: -1,
    hidden: true,
  },
  {
    label: "At least 1 number",
    validate: (value) => /\d/.test(value),
    score: 1,
  },
  {
    label: "At least 1 uppercase letter",
    validate: (value) => /[A-Z]/.test(value),
    score: 1,
  },
  {
    label: "At least 1 lowercase letter",
    validate: (value) => /[a-z]/.test(value),
    score: 1,
  },
  {
    label: "At least 1 special character (!, @, #, etc)",
    validate: (value) => /[^\p{L}\d]/u.test(value),
    score: 2,
  },
];

const passwordScoreMap = {
  tooWeak: {
    label: "Too weak",
    score: 1,
    color: "error",
  },
  weak: {
    label: "Weak",
    score: 3,
    color: "error",
  },
  medium: {
    label: "Medium",
    score: 6,
    color: "warning",
  },
  good: {
    label: "Good",
    score: 9,
    color: "success",
  },
  strong: {
    label: "Strong",
    score: 13,
    color: "success",
  },
} as const satisfies Record<
  string,
  { label: string; score: number; color: TypographyProps["color"] }
>;

const sortedPasswordLevels = Object.values(passwordScoreMap).sort(
  (a, b) => a.score - b.score
);

type PasswordScoreInfo =
  (typeof passwordScoreMap)[keyof typeof passwordScoreMap];

type FormValues = z.infer<typeof signupSchemaForm>;

const emptyFormValues: FormValues = {
  username: "",
  email: "",
  password: "",
  passwordConfirm: "",
};

export const PasswordStrengthMeter = <
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
>({
  form,
  passwordFieldWasFocused,
  name,
}: {
  form: UseFormReturn<TFV>;
  passwordFieldWasFocused: boolean;
  name: TName;
}) => {
  const password = useWatch({ control: form.control, name });
  const fieldState = form.getFieldState(name, form.formState);

  const passwordStrengthInfo = useMemo(() => {
    let anyRequiredRuleFailed = false;

    let result: {
      score: number;
      scorePercent: number;
      renderedRequiredChecks: React.ReactNode[];
      renderedOptionalChecks: React.ReactNode[];
      highestScoreInfo: PasswordScoreInfo;
      maxScore: number;
    } = {
      score: 0,
      scorePercent: 0,
      renderedRequiredChecks: [],
      renderedOptionalChecks: [],
      highestScoreInfo: sortedPasswordLevels[0],
      maxScore: sortedPasswordLevels[sortedPasswordLevels.length - 1].score,
    };

    passwordRules.forEach((rule) => {
      const rulePassed = rule.validate(password);
      if (rule.required && !rulePassed) {
        anyRequiredRuleFailed = true;
      }
      if (anyRequiredRuleFailed) {
        if (rule.required && rulePassed) {
          result.score += rule.score;
        }
      } else if (rulePassed) {
        result.score += rule.score;
      }
      if (!rule.hidden) {
        const node = (
          <HorizontalStack
            key={rule.label}
            addClassName="items-center"
            wrap={false}
          >
            {rulePassed ? (
              <CheckCircleIcon fontSize="small" color="success" />
            ) : rule.required ? (
              <ErrorIcon fontSize="small" color="error" />
            ) : (
              <RemoveCircleIcon fontSize="small" color="action" />
            )}
            <Typography>{rule.label}</Typography>
          </HorizontalStack>
        );
        if (rule.required) {
          result.renderedRequiredChecks.push(node);
        } else {
          result.renderedOptionalChecks.push(node);
        }
      }
    });

    for (const passwordLevel of sortedPasswordLevels) {
      if (passwordLevel.score > result.score) break;
      result.highestScoreInfo = passwordLevel;
    }

    const percent = (result.score / result.maxScore) * 100;
    result.scorePercent = Math.max(0, Math.min(100, percent));

    return result;
  }, [password]);

  return (
    <Collapse
      in={fieldState.isDirty || fieldState.isTouched || passwordFieldWasFocused}
    >
      <div>
        <LinearProgress
          className="w-full my-2"
          variant="determinate"
          color={passwordStrengthInfo.highestScoreInfo.color}
          value={passwordStrengthInfo.scorePercent}
        />
      </div>
      <Typography variant="body2">Required:</Typography>
      <div className="mb-2">{passwordStrengthInfo.renderedRequiredChecks}</div>
      <Typography variant="body2">Nice to have:</Typography>
      <div>{passwordStrengthInfo.renderedOptionalChecks}</div>
    </Collapse>
  );
};

export const UsernameInput = <
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
>({
  form,
  disabled,
  autoFocus,
  name,
}: {
  form: UseFormReturn<TFV>;
  name: TName;
  disabled?: boolean;
  autoFocus?: boolean;
}) => {
  const username = useWatch({
    control: form.control,
    name,
  });
  const user = useUser();
  const fieldState = form.getFieldState(name, form.formState);

  const debouncedUsername = normalizeText(
    useDebouncedValue(username, 750)
  ).toLowerCase();

  const queryDisabled =
    !signupSchemaForm.shape.username.safeParse(debouncedUsername).success ||
    (fieldState.error && fieldState.error?.type !== "availability") ||
    debouncedUsername === user.data?.user?.username ||
    disabled;

  const usernameAvailabilityQuery = useAppQuery(
    trpc.user.checkUsernameAvailability.useQuery(
      { username: debouncedUsername },
      { staleTime: CACHE_TIME_MS.NORMAL, retry: false, enabled: !queryDisabled }
    ),
    { disableLoadingBoundary: true }
  );

  useEffect(() => {
    if (queryDisabled) {
      return;
    }

    if (usernameAvailabilityQuery.data) {
      if (usernameAvailabilityQuery.data.available) {
        if (fieldState.error?.type === "availability") {
          form.clearErrors(name);
        }
      } else {
        form.setError(name, {
          type: "availability",
          message: "Username is already taken.",
        });
      }
    }
    // eslint-disable-next-line
  }, [debouncedUsername, usernameAvailabilityQuery.data]);

  return (
    <Input
      control={form.control}
      name={name}
      autoComplete="username"
      label="Username"
      type="text"
      fullWidth
      disabled={disabled}
      autoFocus={autoFocus}
      endAccessory={
        <>
          {usernameAvailabilityQuery.isFetching ? (
            <CircularProgress size={24} />
          ) : usernameAvailabilityQuery.data && !queryDisabled ? (
            usernameAvailabilityQuery.data.available ? (
              <CheckCircleIcon color="success" />
            ) : (
              <Tooltip title={fieldState.error?.message}>
                <ErrorIcon color="error" />
              </Tooltip>
            )
          ) : null}
        </>
      }
    />
  );
};

const Signup = (props: Props) => {
  const [passwordFieldWasFocused, setPasswordFieldWasFocused] = useState(false);

  const isDesktop = useIsDesktop();

  const form = useForm<FormValues>({
    defaultValues: emptyFormValues,
    resolver: zodResolver(signupSchemaForm),
  });

  const user = useUser();
  const { addAppSnackbar } = useAppSnackbar();
  const qc = useQueryClient();

  const changeEmailMutation = trpc.user.changeEmail.useMutation({
    onSuccess(data) {
      addAppSnackbar({
        message: (
          <>
            Verification email sent to <strong>{data.email}</strong>. If you
            don’t see this email in your inbox within 15 minutes, look for it in
            your spam mail folder.
          </>
        ),
        variant: "info",
        durationMs: 0,
      });
      props.onSuccess?.();
    },
  });
  const signUpMutation = trpc.auth.signUpCredentials.useMutation({
    onSuccess(data) {
      addAppSnackbar({
        message: "You have successfully signed up.",
        variant: "success",
      });
      if (data.user.pendingEmail) {
        changeEmailMutation.mutate({ email: data.user.pendingEmail });
      } else {
        props.onSuccess?.();
      }
      userLoginLifecycle(qc);
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const usernameError = form.formState.errors.username;
    if (usernameError) {
      form.setError("username", { ...usernameError }, { shouldFocus: true });
      return;
    }
    signUpMutation.mutate(values);
  };

  const isSubmitting =
    signUpMutation.isPending ||
    changeEmailMutation.isPending ||
    user.isFetching;

  return (
    <Section addClassName="mt-5">
      <AuthWrapper
        authType="signup"
        disabled={isSubmitting}
        onSuccess={props.onSuccess}
        guestHidden={props.guestHidden}
      >
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <VerticalStack>
            <UsernameInput form={form} name="username" autoFocus={isDesktop} />
            <Input
              control={form.control}
              name="email"
              label="Email (optional)"
              type="email"
              autoComplete="email"
              fullWidth
            />
            <div>
              <Input
                control={form.control}
                name="password"
                label="Password"
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
                name="password"
                passwordFieldWasFocused={passwordFieldWasFocused}
              />
            </div>
            <Input
              control={form.control}
              name="passwordConfirm"
              label="Password confirmation"
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
              Sign Up
            </Button>
          </VerticalStack>
        </form>
      </AuthWrapper>
    </Section>
  );
};

export default Signup;
