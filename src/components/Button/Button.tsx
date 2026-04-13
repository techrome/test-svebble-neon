import React from "react";
import {
  CircularProgress,
  Button as MuiButton,
  type ButtonProps as MuiButtonProps,
} from "@mui/material";
import clsx from "clsx";

type Props = MuiButtonProps & {
  isLoading?: boolean;
};

const Button = ({ children, isLoading, ...props }: Props) => {
  return (
    <MuiButton {...props} {...(isLoading ? { disabled: true } : {})}>
      <div className={clsx("transition-all", isLoading && "opacity-50")}>
        {children}
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex justify-center items-center text-mui-text-primary">
          <CircularProgress size={20} color="inherit" />
        </div>
      )}
    </MuiButton>
  );
};

export default Button;
