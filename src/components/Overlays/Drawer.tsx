import React from "react";
import {
  DialogTitle,
  DialogTitleProps,
  Divider,
  SwipeableDrawer,
  SwipeableDrawerProps,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@/components/Button/IconButton";

export type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onExited?: () => void;
  title?: string;
  children: React.ReactNode;
  muiDrawerProps?: SwipeableDrawerProps;
  dialogTitleProps?: DialogTitleProps;
};

const noop = () => {};

const Drawer = ({
  isOpen,
  title,
  onExited,
  muiDrawerProps,
  dialogTitleProps,
  onClose,
  children,
}: DrawerProps) => {
  return (
    <SwipeableDrawer
      open={isOpen}
      disableSwipeToOpen
      disableDiscovery
      onClose={onClose}
      onOpen={noop}
      slotProps={{
        transition: { onExited },
        paper: { className: "w-full sm:w-md max-w-full" },
      }}
      anchor="right"
      {...muiDrawerProps}
    >
      <DialogTitle
        className="flex justify-between items-center p-2 sm:p-3 border border-transparent"
        {...dialogTitleProps}
      >
        <span>{title}</span>
        <IconButton
          size="large"
          color="inherit"
          aria-label="close drawer"
          onClick={onClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      {children}
    </SwipeableDrawer>
  );
};

export default Drawer;
