import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm, useWatch } from "react-hook-form";
import z from "zod";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";

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

type Props = {
  onSubmit?: () => void;
};

const passwordRules = [
  {
    label: "Contains at least 8 characters",
    error: "Password must be at least 8 characters long",
    validate: (value: string) => value.length >= 8,
    required: true,
    score: 1,
  },
  {
    label: "Contains at least 16 characters",
    validate: (value: string) => value.length >= 16,
    score: 2,
  },
  {
    label: "Contains at least 1 number",
    validate: (value: string) => /\d/.test(value),
    score: 2,
  },
  {
    label: "Contains at least 1 uppercase and 1 lowercase character",
    validate: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value),
    score: 2,
  },
  {
    label: "Contains at least 1 special character (!, @, #, etc)",
    validate: (value: string) => /[^\p{L}\d]/u.test(value),
    score: 3,
  },
] satisfies {
  label: string;
  error?: string;
  validate: (v: string) => boolean;
  required?: boolean;
  score: number;
}[];

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
    score: 5,
    color: "warning",
  },
  good: {
    label: "Good",
    score: 8,
    color: "success",
  },
  strong: {
    label: "Strong",
    score: 10,
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
    for (const rule of passwordRules) {
      if (rule.required && !rule.validate(password)) {
        ctx.addIssue({
          code: "custom",
          message: rule.error,
        });
      }
    }
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

  const [password] = useWatch({ control: form.control, name: ["password"] });

  const passwordStrengthInfo = React.useMemo(() => {
    let anyRequiredRuleFailed = false;

    let result: {
      score: number;
      scorePercent: number;
      renderedChecks: React.ReactNode[];
      highestScoreInfo: PasswordScoreInfo;
      maxScore: number;
    } = {
      score: 0,
      scorePercent: 0,
      renderedChecks: [],
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
      result.renderedChecks.push(
        <HorizontalStack
          key={rule.label}
          addClassName="items-center"
          wrap={false}
        >
          {rulePassed ? (
            <CheckCircleIcon fontSize="small" color="success" />
          ) : rule.required ? (
            <CancelIcon fontSize="small" color="action" />
          ) : (
            <WarningIcon fontSize="small" color="action" />
          )}
          <div>{rule.label}</div>
        </HorizontalStack>
      );
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
                Password strength:{" "}
                <Typography
                  color={passwordStrengthInfo.highestScoreInfo.color}
                  component="span"
                >
                  {passwordStrengthInfo.highestScoreInfo.label}
                </Typography>
              </div>
              <div>{passwordStrengthInfo.renderedChecks}</div>
            </Collapse>
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
    </Section>
  );
};

export default Signup;
