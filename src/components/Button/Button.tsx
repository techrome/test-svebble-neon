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

const Button = ({ children, ...props }: Props) => {
  return (
    <MuiButton {...props} {...(props.isLoading ? { disabled: true } : {})}>
      <div className={clsx("transition-all", props.isLoading && "opacity-50")}>
        {children}
      </div>

      {props.isLoading && (
        <div className="absolute inset-0 flex justify-center items-center">
          <CircularProgress size={20} />
        </div>
      )}
    </MuiButton>
  );
};

export default Button;
