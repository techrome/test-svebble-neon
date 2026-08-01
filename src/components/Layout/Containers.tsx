import {
  Container as MuiContainer,
  type ContainerProps as MuiContainerProps,
} from "@mui/material";
import clsx from "clsx";
import React, { forwardRef } from "react";

import { Breakpoints } from "@/utils/theme";

type BaseSectionProps = {
  children?: React.ReactNode;
  addClassName?: string;
  fullWidth?: boolean;
  padding?: "md" | "xs";
} & React.ComponentProps<"div">;

type ContainerProps = MuiContainerProps;

type LayoutBreakpoints = Partial<Record<Breakpoints | "xxs" | "none", string>>;

const switchingStackBreakpoints = {
  sm: "sm:flex-row sm:flex-wrap",
  md: "md:flex-row md:flex-wrap",
  lg: "lg:flex-row lg:flex-wrap",
} as const satisfies LayoutBreakpoints;

export const defaultPadding = "p-2 sm:p-3";
export const defaultPaddingXs = "p-1 sm:p-2";

export const Section = ({
  children,
  addClassName,
  fullWidth = true,
  padding = "md",
  ...props
}: BaseSectionProps) => {
  return (
    <div
      className={clsx(
        fullWidth && "w-full",
        padding === "md" ? defaultPadding : defaultPaddingXs,
        addClassName
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const spacingMapping = {
  xxs: "gap-0.5",
  xs: "gap-1 sm:gap-2",
  sm: "gap-2 sm:gap-3",
  md: "gap-4 sm:gap-6",
  lg: "gap-8 sm:gap-12",
  none: "",
} as const satisfies LayoutBreakpoints;

type StackProps = {
  spacing?: keyof typeof spacingMapping;
  withPadding?: boolean;
  fullWidth?: boolean;
  minWidth?: boolean;
  wrap?: boolean;
} & BaseSectionProps;

export const VerticalStack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      children,
      addClassName,
      spacing = "sm",
      withPadding,
      fullWidth = true,
      minWidth,
      ...props
    }: StackProps,
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          `flex flex-col ${spacingMapping[spacing]}`,
          fullWidth && "w-full",
          minWidth && "min-w-0",
          withPadding && defaultPadding,
          addClassName
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export const HorizontalStack = forwardRef<HTMLDivElement, StackProps>(
  (
    {
      children,
      addClassName,
      spacing = "sm",
      withPadding,
      fullWidth,
      minWidth,
      wrap = true,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          wrap && "flex-wrap",
          `max-w-full flex ${spacingMapping[spacing]}`,
          withPadding && defaultPadding,
          fullWidth && "w-full",
          minWidth && "min-w-0",
          addClassName
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

type SwitchingStackProps = BaseSectionProps & {
  breakpoint?: keyof typeof switchingStackBreakpoints;
};

export const SwitchingStack = ({
  children,
  addClassName,
  breakpoint = "md",
  ...props
}: SwitchingStackProps) => {
  return (
    <div
      className={clsx(
        `w-full flex flex-col ${switchingStackBreakpoints[breakpoint]} gap-2 sm:gap-3`,
        addClassName
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const Container = ({ children, ...props }: ContainerProps) => {
  return <MuiContainer {...props}>{children}</MuiContainer>;
};
