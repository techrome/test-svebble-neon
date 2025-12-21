import {
  Container as MuiContainer,
  type ContainerProps as MuiContainerProps,
} from "@mui/material";
import clsx from "clsx";
import React from "react";

import { Breakpoints } from "@/utils/theme";

type BaseSectionProps = {
  children?: React.ReactNode;
  addClassName?: string;
  fullWidth?: boolean;
} & React.ComponentProps<"div">;

type ContainerProps = MuiContainerProps;

type LayoutBreakpoints = Partial<Record<Breakpoints | "none", string>>;

const switchingStackBreakpoints = {
  md: "md:flex-row md:flex-wrap",
  lg: "lg:flex-row lg:flex-wrap",
} as const satisfies LayoutBreakpoints;

export const defaultPadding = "p-2 sm:p-3";

export const Section = ({
  children,
  addClassName,
  fullWidth = true,
  ...props
}: BaseSectionProps) => {
  return (
    <div
      className={clsx(fullWidth && "w-full", defaultPadding, addClassName)}
      {...props}
    >
      {children}
    </div>
  );
};

export const spacingMapping = {
  sm: "gap-2 sm:gap-3",
  md: "gap-4 sm:gap-6",
  lg: "gap-8 sm:gap-12",
  xs: "gap-1 sm:gap-2",
  none: "",
} as const satisfies LayoutBreakpoints;

type StackProps = {
  spacing?: keyof typeof spacingMapping;
  withPadding?: boolean;
  fullWidth?: boolean;
  wrap?: boolean;
} & BaseSectionProps;

export const VerticalStack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      children,
      addClassName,
      spacing = "sm",
      withPadding,
      ...props
    }: StackProps,
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          `w-full flex flex-col ${spacingMapping[spacing]}`,
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

export const HorizontalStack = ({
  children,
  addClassName,
  spacing = "sm",
  withPadding,
  fullWidth,
  wrap = true,
  ...props
}: StackProps) => {
  return (
    <div
      className={clsx(
        wrap && "flex-wrap",
        `max-w-full flex ${spacingMapping[spacing]}`,
        withPadding && defaultPadding,
        fullWidth && "w-full",
        addClassName
      )}
      {...props}
    >
      {children}
    </div>
  );
};

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
