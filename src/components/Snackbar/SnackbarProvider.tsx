import React from "react";
import { CollapseProps } from "@mui/material";
import { SnackbarProvider as NotistackSnackbarProvider } from "notistack";

import Collapse from "@/components/Collapse/Collapse";
import Snackbar from "@/components/Snackbar/Snackbar";

type Props = {
  children: React.ReactNode;
};

const CollapseTransition = (props: CollapseProps) => {
  return <Collapse {...props} />;
};

const SnackbarProvider = (props: Props) => {
  return (
    <NotistackSnackbarProvider
      maxSnack={6}
      anchorOrigin={{
        horizontal: "right",
        vertical: "bottom",
      }}
      Components={{
        error: Snackbar,
        info: Snackbar,
        success: Snackbar,
        warning: Snackbar,
      }}
      TransitionComponent={CollapseTransition}
      transitionDuration={{
        exit: 150,
      }}
    >
      {props.children}
    </NotistackSnackbarProvider>
  );
};

export default SnackbarProvider;
