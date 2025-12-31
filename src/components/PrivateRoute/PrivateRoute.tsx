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
        errorCode={401}
        errorText="Unauthorized. Please log in to access this page"
      />
    );
  }

  return <>{props.children}</>;
};

export default PrivateRoute;
