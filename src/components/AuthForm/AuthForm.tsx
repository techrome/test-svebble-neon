import Login from "@/components/AuthForm/Login";
import Signup from "@/components/AuthForm/Signup";
import Button from "@/components/Button/Button";
import Tabs from "@/components/Tabs/Tabs";
import React from "react";

export type AuthType = "login" | "signup";

type Props = {
  initialAuthType?: AuthType;
  onAuthTypeChange?: (type: AuthType) => void;
};

export const authTypeMapping = {
  login: "Log In",
  signup: "Sign Up",
} satisfies Record<AuthType, string>;

const AuthForm = (props: Props) => {
  const [authType, setAuthType] = React.useState<AuthType>(
    props.initialAuthType || "login"
  );
  return (
    <div>
      <Tabs
        value={authType}
        onChange={(e, value) => {
          setAuthType(value);
          props.onAuthTypeChange?.(value);
        }}
        variant="fullWidth"
        tabs={[
          {
            value: "login" satisfies AuthType,
            label: authTypeMapping.login,
            panel: <Login />,
          },
          {
            value: "signup" satisfies AuthType,
            label: authTypeMapping.signup,
            panel: <Signup />,
          },
        ]}
      />
    </div>
  );
};

export default AuthForm;
