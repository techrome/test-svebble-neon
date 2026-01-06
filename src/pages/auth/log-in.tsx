import React from "react";

import AuthForm, {
  authTypeRoutesMapping,
} from "@/components/AuthForm/AuthForm";
import { useRouter } from "next/router";

const LogIn = () => {
  const router = useRouter();
  return (
    <AuthForm
      initialAuthType="login"
      onAuthTypeChange={(value) => {
        router.push(authTypeRoutesMapping[value]);
      }}
      onSuccess={() => {}}
    />
  );
};

export default LogIn;
