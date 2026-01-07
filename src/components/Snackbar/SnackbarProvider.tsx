import Snackbar from "@/components/Snackbar/Snackbar";
import { SnackbarProvider as NotistackSnackbarProvider } from "notistack";
import React from "react";

type Props = {
  children: React.ReactNode;
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
      transitionDuration={{
        exit: 150,
      }}
    >
      {props.children}
    </NotistackSnackbarProvider>
  );
};

export default SnackbarProvider;
