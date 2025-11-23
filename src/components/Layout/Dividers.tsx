import React from "react";
import {
  Divider as MuiDivider,
  DividerProps as MuiDividerProps,
} from "@mui/material";
import { Breakpoints } from "@/utils/theme";

type DividerProps = MuiDividerProps;
type SwitchingDividerProps = { breakpoint?: Breakpoints } & MuiDividerProps;

export const Divider = ({ ...props }: DividerProps) => {
  return <MuiDivider {...props} />;
};

export const SwitchingDivider = ({
  breakpoint = "md",
  ...props
}: SwitchingDividerProps) => {
  return (
    <>
      <MuiDivider
        orientation="vertical"
        flexItem
        sx={(theme) => ({
          [theme.breakpoints.down(breakpoint)]: {
            display: "none",
          },
        })}
        {...props}
      />
      <MuiDivider
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
