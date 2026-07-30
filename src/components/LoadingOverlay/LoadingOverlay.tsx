import React, { forwardRef, type ReactNode } from "react";
import clsx from "clsx";
import {
  Backdrop,
  CircularProgress,
  CircularProgressProps,
} from "@mui/material";

type Props = {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  progressColor?: CircularProgressProps["color"];
};

const LoadingOverlay = forwardRef<HTMLDivElement, Props>(
  (
    {
      isLoading,
      children,
      className,
      overlayClassName,
      progressColor = "primary",
      ...divProps
    }: Props,
    ref
  ) => {
    return (
      <div {...divProps} className={clsx("relative", className)} ref={ref}>
        {children}
        <Backdrop
          open={isLoading}
          className={clsx(
            "absolute inset-0 rounded-[inherit]",
            overlayClassName
          )}
        >
          <CircularProgress color={progressColor} size={24} />
        </Backdrop>
      </div>
    );
  }
);

export default LoadingOverlay;
