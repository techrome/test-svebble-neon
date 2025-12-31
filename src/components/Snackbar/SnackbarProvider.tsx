import Snackbar from "@/components/Snackbar/Snackbar";
import { useMediaQuery } from "@mui/material";
import { SnackbarProvider as NotistackSnackbarProvider } from "notistack";
import React from "react";

type Props = {
  children: React.ReactNode;
};

const SnackbarProvider = (props: Props) => {
  const isLargeScreen = useMediaQuery((theme) => theme.breakpoints.up("md"));

  return (
    <NotistackSnackbarProvider
      maxSnack={6}
      anchorOrigin={{
        horizontal: "right",
        vertical: isLargeScreen ? "bottom" : "top",
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
