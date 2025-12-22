import React from "react";
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

import Button from "@/components/Button/Button";
import Checkbox from "@/components/Fields/Checkbox";
import Input from "@/components/Fields/Input";
import {
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import Link from "@/components/Link/Link";
import { ROUTES } from "@/utils/routes";
import { useAppSnackbar } from "@/utils/snackbar";
import { Text } from "@/utils/validators/helpers/text";
import { LinearProgress, Typography, TypographyProps } from "@mui/material";
import Collapse from "@/components/Collapse/Collapse";
import { Divider } from "@/components/Layout/Dividers";
import { passwordMinLength } from "@/utils/validators/shared/auth";

type Props = {
  onSubmit?: () => void;
};

type PasswordRule = {
  label: string;
  error?: string;
  validate: (v: string) => boolean;
  required?: boolean;
  score: number;
  hidden?: boolean;
};

const requiredPasswordRules: PasswordRule[] = [
  {
    label: "At least 8 characters",
    error: "Password must be at least 8 characters long",
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

const zPassword = Text.Title({ shouldTrim: false, required: true }).superRefine(
  (password, ctx) => {
    requiredPasswordRules.forEach((rule) => {
      if (!rule.validate(password)) {
        ctx.addIssue({
          code: "custom",
          message: rule.error,
        });
      }
    });
  }
);

const schemaForm = z
  .object({
    username: Text.Handle({ required: true }),
    email: Text.Title().pipe(z.email()).optional().or(z.literal("")),
    password: zPassword,
    passwordConfirm: Text.Title({ shouldTrim: false, required: true }),
    agreeTerms: z.boolean().refine((v) => Boolean(v), {
      error: "You must agree to the Terms and Privacy Policy",
    }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    error: "Passwords do not match",
    path: ["passwordConfirm"],
  });

type FormValues = z.infer<typeof schemaForm>;

const emptyFormValues: FormValues = {
  username: "",
  email: "",
  password: "",
  passwordConfirm: "",
  agreeTerms: false,
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

const Signup = (props: Props) => {
  const [passwordFieldWasFocused, setPasswordFieldWasFocused] =
    React.useState(false);

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
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
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
          <Checkbox
            control={form.control}
            name="agreeTerms"
            label={
              <span>
                I have read and agree to the{" "}
                <Link target="_blank" href={ROUTES.terms}>
                  Terms and Conditions
                </Link>{" "}
                and{" "}
                <Link target="_blank" href={ROUTES.privacyPolicy}>
                  Privacy Policy
                </Link>
              </span>
            }
          />
          <Button variant="contained" type="submit" size="large">
            Sign Up
          </Button>
        </VerticalStack>
      </form>
      <Divider className="my-4">or</Divider>
      <Button variant="outlined" fullWidth size="large">
        Continue as guest
      </Button>
    </Section>
  );
};

export default Signup;
