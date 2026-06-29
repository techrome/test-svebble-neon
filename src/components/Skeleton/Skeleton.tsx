import React from "react";
import {
  Skeleton as MuiSkeleton,
  type SkeletonProps as MuiSkeletonProps,
} from "@mui/material";
type Props = { withDefaultHeight?: boolean } & MuiSkeletonProps;

const Skeleton = ({
  height = 60,
  withDefaultHeight = true,
  ...props
}: Props) => {
  return <MuiSkeleton {...(withDefaultHeight ? { height } : {})} {...props} />;
};

export default Skeleton;
