import React from "react";
import {
  Modal as MuiModal,
  type ModalProps as MuiModalProps,
  Box,
  Paper,
  Fade,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@/components/Button/IconButton";
import { PartialFor } from "@/utils/types";

type MuiOnClose = NonNullable<MuiModalProps["onClose"]>;
type MuiCloseArgs = Parameters<MuiOnClose>;

export type BaseModalProps = {
  isOpen: boolean;
  onClose: (event?: MuiCloseArgs[0], reason?: MuiCloseArgs[1]) => void;
  onExited?: () => void;
  children: React.ReactNode;
  modalProps?: PartialFor<MuiModalProps, "open" | "children">;
  modalSlotProps?: MuiModalProps["slotProps"];
  showCloseButton?: boolean;
};

export const CloseModalButton = ({
  onClose,
  className,
}: Pick<BaseModalProps, "onClose"> & { className?: string }) => (
  <IconButton
    className={className}
    size="large"
    color="inherit"
    aria-label="close modal"
    onClick={onClose}
  >
    <CloseIcon />
  </IconButton>
);

const BaseModal = ({
  isOpen,
  onClose,
  onExited,
  children,
  modalProps,
  modalSlotProps,
  showCloseButton = true,
}: BaseModalProps) => {
  return (
    <MuiModal
      open={isOpen}
      onClose={onClose}
      closeAfterTransition
      onTransitionExited={onExited}
      slotProps={{
        backdrop: {
          className: "bg-black/50",
        },
        ...modalSlotProps,
      }}
      {...modalProps}
    >
      <Fade in={isOpen}>
        <div className="fixed inset-0 outline-none">
          {showCloseButton && <CloseModalButton onClose={onClose} />}

          {children}
        </div>
      </Fade>
    </MuiModal>
  );
};

export default BaseModal;
