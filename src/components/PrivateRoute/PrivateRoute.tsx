import { CircularProgress } from "@mui/material";
import React from "react";

import { useUser } from "@/trpc/hooks/useUser";
import ErrorSection from "@/components/GlobalError/ErrorSection";

type Props = {
  children: React.ReactNode;
};

type AuthedUser = NonNullable<
  NonNullable<ReturnType<typeof useUser>["data"]>["user"]
>;

export const AuthedUserContext = React.createContext<AuthedUser | null>(null);

const PrivateRoute = (props: Props) => {
  const user = useUser();

  if (user.isPending) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <CircularProgress />
      </div>
    );
  }

  if (!user.data?.user) {
    return (
      <ErrorSection
        errorCode={401}
        errorText="Unauthorized. Please log in to access this page."
      />
    );
  }

  return (
    <AuthedUserContext.Provider value={user.data.user}>
      {props.children}
    </AuthedUserContext.Provider>
  );
};

export default PrivateRoute;
