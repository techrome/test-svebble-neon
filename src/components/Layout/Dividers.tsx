import React from "react";
import {
  Divider as MuiDivider,
  DividerProps as MuiDividerProps,
} from "@mui/material";
import { Breakpoints } from "@/utils/theme";

type DividerProps = MuiDividerProps;
type SwitchingDividerProps = {
  breakpoint?: Breakpoints;
  belowBreakpointOrientation?: MuiDividerProps["orientation"];
  belowBreakpointFlexItem?: boolean;
  aboveBreakpointFlexItem?: boolean;
} & MuiDividerProps;

export const Divider = ({ ...props }: DividerProps) => {
  return <MuiDivider {...props} />;
};

export const SwitchingDivider = ({
  breakpoint = "md",
  belowBreakpointOrientation = "vertical",
  belowBreakpointFlexItem = true,
  aboveBreakpointFlexItem,
  ...props
}: SwitchingDividerProps) => {
  return (
    <>
      <MuiDivider
        orientation={
          belowBreakpointOrientation === "vertical" ? "horizontal" : "vertical"
        }
        flexItem={aboveBreakpointFlexItem}
        sx={(theme) => ({
          [theme.breakpoints.down(breakpoint)]: {
            display: "none",
          },
        })}
        {...props}
      />
      <MuiDivider
        orientation={belowBreakpointOrientation}
        flexItem={belowBreakpointFlexItem}
        sx={(theme) => ({
          [theme.breakpoints.up(breakpoint)]: {
            display: "none",
          },
        })}
        {...props}
      />
    </>
  );
};
