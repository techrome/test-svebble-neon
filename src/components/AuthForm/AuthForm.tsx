import ForgotPassword from "@/components/AuthForm/ForgotPassword";
import Login from "@/components/AuthForm/Login";
import Signup from "@/components/AuthForm/Signup";
import Tabs from "@/components/Tabs/Tabs";
import { ROUTES } from "@/utils/routes";
import React from "react";

export type AuthType = "login" | "signup" | "accountRecovery";

type Props = {
  initialAuthType?: AuthType;
  onAuthTypeChange?: (type: AuthType) => void;
  onSuccess?: () => void;
};

export const authTypeMapping = {
  login: "Log In",
  signup: "Sign Up",
  accountRecovery: "Account Recovery",
} satisfies Record<AuthType, string>;

export const authTypeRoutesMapping = {
  login: ROUTES.logIn,
  signup: ROUTES.signUp,
  accountRecovery: ROUTES.accountRecovery,
} satisfies Record<AuthType, string>;

const AuthForm = (props: Props) => {
  const [authType, setAuthType] = React.useState<AuthType>(
    props.initialAuthType || "login"
  );

  const onAuthTypeChange = (value: AuthType) => {
    setAuthType(value);
    props.onAuthTypeChange?.(value);
  };

  return (
    <div>
      <Tabs
        value={authType}
        onChange={(e, value) => {
          onAuthTypeChange(value);
        }}
        variant="fullWidth"
        tabs={[
          {
            value: "login" satisfies AuthType,
            label: authTypeMapping.login,
            panel: (
              <Login
                onSuccess={props.onSuccess}
                onForgotPasswordClick={() => {
                  onAuthTypeChange("accountRecovery");
                }}
              />
            ),
          },
          {
            value: "signup" satisfies AuthType,
            label: authTypeMapping.signup,
            panel: <Signup onSuccess={props.onSuccess} />,
          },
        ]}
      />
      {authType === "accountRecovery" && <ForgotPassword />}
    </div>
  );
};

export default AuthForm;
