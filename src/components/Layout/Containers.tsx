import {
  Container as MuiContainer,
  ContainerProps as MuiContainerProps,
} from "@mui/material";
import clsx from "clsx";
import React from "react";

import { Breakpoints } from "@/utils/theme";

type BaseSectionProps = {
  children: React.ReactNode;
  addClassName?: string;
} & React.ComponentProps<"div">;

type ContainerProps = MuiContainerProps;

type LayoutBreakpoints = Partial<Record<Breakpoints, string>>;

const switchingStackBreakpoints = {
  md: "md:flex-row md:flex-wrap",
  lg: "lg:flex-row lg:flex-wrap",
} as const satisfies LayoutBreakpoints;

export const Section = ({
  children,
  addClassName,
  ...props
}: BaseSectionProps) => {
  return (
    <div className={clsx("w-full p-2 sm:p-3", addClassName)} {...props}>
      {children}
    </div>
  );
};

const spacingMapping = {
  sm: "gap-2 sm:gap-3",
  md: "gap-4 sm:gap-6",
  lg: "gap-8 sm:gap-12",
} as const satisfies LayoutBreakpoints;

type StackProps = {
  spacing?: keyof typeof spacingMapping;
} & BaseSectionProps;

export const VerticalStack = ({
  children,
  addClassName,
  spacing = "sm",
  ...props
}: StackProps) => {
  return (
    <div
      className={clsx(
        `w-full flex flex-col ${spacingMapping[spacing]}`,
        addClassName
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const HorizontalStack = ({
  children,
  addClassName,
  spacing = "sm",
  ...props
}: StackProps) => {
  return (
    <div
      className={clsx(
        `w-full flex flex-wrap ${spacingMapping[spacing]}`,
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
