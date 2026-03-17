import React from "react";
import {
  Skeleton as MuiSkeleton,
  type SkeletonProps as MuiSkeletonProps,
} from "@mui/material";
type Props = MuiSkeletonProps;

const Skeleton = ({ height = 60, ...props }: Props) => {
  return <MuiSkeleton height={height} {...props} />;
};

export default Skeleton;
