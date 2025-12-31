import React, { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SubmitHandler,
  useForm,
  UseFormReturn,
  useWatch,
} from "react-hook-form";
import z from "zod";
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
import { CACHE_TIME } from "@/utils/cacheTime";
import { useDebouncedValue } from "@/utils/useDebouncedValue";
import { normalizeText } from "@/utils/stringUtils";
import Tooltip from "@/components/Tooltip/Tooltip";
import useAppQuery from "@/utils/useAppQuery";
import { useAppDispatch } from "@/redux/hooks";
import { eventHappened } from "@/redux/slices/misc";

type Props = {
  onSuccess?: () => void;
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

const PasswordStrengthMeter = ({
  form,
  passwordFieldWasFocused,
}: {
  form: UseFormReturn<FormValues>;
  passwordFieldWasFocused: boolean;
}) => {
  const [password] = useWatch({ control: form.control, name: ["password"] });

  const passwordStrengthInfo = React.useMemo(() => {
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
      in={
        form.formState.dirtyFields.password ||
        form.formState.touchedFields.password ||
        passwordFieldWasFocused
      }
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

const UsernameInput = ({ form }: { form: UseFormReturn<FormValues> }) => {
  const [username] = useWatch({ control: form.control, name: ["username"] });

  const fieldState = form.getFieldState("username", form.formState);

  const debouncedUsername = normalizeText(
    useDebouncedValue(username, 750)
  ).toLowerCase();

  const queryDisabled =
    !signupSchemaForm.shape.username.safeParse(debouncedUsername).success ||
    (fieldState.error && fieldState.error?.type !== "availability");

  const usernameAvailabilityQuery = useAppQuery(
    trpc.auth.checkUsernameAvailability.useQuery(
      { username: debouncedUsername },
      { staleTime: CACHE_TIME.NORMAL, retry: false, enabled: !queryDisabled }
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
          form.clearErrors("username");
        }
      } else {
        form.setError("username", {
          type: "availability",
          message: "Username is already taken",
        });
      }
    }
  }, [debouncedUsername, usernameAvailabilityQuery.data]);

  return (
    <Input
      control={form.control}
      name="username"
      label="Username"
      type="text"
      fullWidth
      endAccessory={
        <>
          {usernameAvailabilityQuery.isFetching ? (
            <CircularProgress size={24} />
          ) : usernameAvailabilityQuery.data ? (
            usernameAvailabilityQuery.data.available ? (
              <CheckCircleIcon color="success" />
            ) : (
              <Tooltip title="Username is already taken">
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
  const [passwordFieldWasFocused, setPasswordFieldWasFocused] =
    React.useState(false);

  const form = useForm<FormValues>({
    defaultValues: emptyFormValues,
    resolver: zodResolver(signupSchemaForm),
  });

  const { addAppSnackbar } = useAppSnackbar();
  const dispatch = useAppDispatch();
  const utils = trpc.useUtils();

  const changeEmailMutation = trpc.auth.changeEmail.useMutation({
    onSuccess(data) {
      addAppSnackbar({
        message: (
          <>
            We have sent a verification email to <strong>{data.email}</strong>.
            Please check your inbox and spam folder
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
        message: "You have successfully signed up",
        variant: "success",
      });
      if (data.user.pendingEmail) {
        changeEmailMutation.mutate({ email: data.user.pendingEmail });
      } else {
        props.onSuccess?.();
      }
      utils.auth.user.setData(undefined, {
        user: data.user,
      });
      utils.auth.user.invalidate();
      dispatch(eventHappened("hasAuthenticated"));
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
    signUpMutation.isPending || changeEmailMutation.isPending;

  return (
    <Section addClassName="mt-5">
      <AuthWrapper authType="signup" disabled={isSubmitting}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <VerticalStack>
            <UsernameInput form={form} />
            <Input
              control={form.control}
              name="email"
              label="Email (optional)"
              type="email"
              fullWidth
            />
            <div>
              <Input
                control={form.control}
                name="password"
                label="Password"
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
              label="Password confirmation"
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
              Sign Up
            </Button>
          </VerticalStack>
        </form>
      </AuthWrapper>
    </Section>
  );
};

export default Signup;
