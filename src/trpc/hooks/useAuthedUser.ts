import React from "react";

import useUser from "@/trpc/hooks/useUser";

const useAuthedUserData = () => {
  const user = useUser();

  if (!user.data?.user) {
    throw new Error(
      "useAuthedUserData must be guaranteed to have the user field."
    );
  }

  return user.data.user;
};

export default useAuthedUserData;
