import React from "react";

import AuthForm, {
  authTypeRoutesMapping,
} from "@/components/AuthForm/AuthForm";
import { useRouter } from "next/router";

const AccountRecovery = () => {
  const router = useRouter();
  return (
    <AuthForm
      initialAuthType="accountRecovery"
      onAuthTypeChange={(value) => {
        router.push(authTypeRoutesMapping[value]);
      }}
      onSuccess={() => {}}
    />
  );
};

export default AccountRecovery;
