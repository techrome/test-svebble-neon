import React from "react";
import {
  Pagination as MuiPagination,
  type PaginationProps as MuiPaginationProps,
} from "@mui/material";

type Props = MuiPaginationProps;

const Pagination = (props: Props) => {
  return (
    <MuiPagination
      showFirstButton
      showLastButton
      siblingCount={2}
      boundaryCount={3}
      classes={{ ul: "flex justify-center" }}
      {...props}
    />
  );
};

export default Pagination;
