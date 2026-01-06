import React from "react";

import AuthForm, {
  authTypeRoutesMapping,
} from "@/components/AuthForm/AuthForm";
import { useRouter } from "next/router";

const SignUp = () => {
  const router = useRouter();
  return (
    <AuthForm
      initialAuthType="signup"
      onAuthTypeChange={(value) => {
        router.push(authTypeRoutesMapping[value]);
      }}
      onSuccess={() => {}}
    />
  );
};

export default SignUp;
