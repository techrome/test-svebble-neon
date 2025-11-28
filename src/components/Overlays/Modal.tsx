import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogProps,
  DialogTitleProps,
  DialogContentProps,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@/components/Button/IconButton";

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onExited?: () => void;
  title?: string;
  children: React.ReactNode;
  dialogProps?: DialogProps;
  dialogTitleProps?: DialogTitleProps;
  dialogContentProps?: DialogContentProps;
};

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  onExited,
  dialogProps,
  dialogTitleProps,
  dialogContentProps,
}: ModalProps) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      slotProps={{ transition: { onExited } }}
      {...dialogProps}
    >
      <DialogTitle
        className="flex justify-between items-center"
        {...dialogTitleProps}
      >
        <span>{title}</span>
        <IconButton
          size="large"
          color="inherit"
          aria-label="close modal"
          onClick={onClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent {...dialogContentProps}>{children}</DialogContent>
    </Dialog>
  );
};

export default Modal;
