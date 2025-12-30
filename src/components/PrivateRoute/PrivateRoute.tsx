import { CircularProgress } from "@mui/material";
import React from "react";

import useUser from "@/trpc/hooks/useUser";
import ErrorSection from "@/components/GlobalError/ErrorSection";

type Props = {
  children: React.ReactNode;
};

const PrivateRoute = (props: Props) => {
  const user = useUser();

  if (user.isPending) {
    return <CircularProgress />;
  }

  if (!user.data?.user) {
    return (
      <ErrorSection
        errorCode={403}
        errorText="Unauthorized. You don't have access to this page"
        errorDetails={
          <>
            <p>
              <strong>This can happen for various reasons:</strong>
            </p>
            <ul>
              <li>If you are logged out, please try logging in again.</li>
              <li>
                Your account may not have sufficient permissions to view this
                page.
              </li>
            </ul>
          </>
        }
      />
    );
  }

  return <>{props.children}</>;
};

export default PrivateRoute;
