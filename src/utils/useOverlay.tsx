import React from "react";
import { ActionCreatorWithPayload } from "@reduxjs/toolkit";

import Modal, { type ModalProps } from "@/components/Overlays/Modal";
import {
  setDrawerState,
  setModalState,
  type Overlay,
} from "@/redux/slices/overlays";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { RootState } from "@/redux";
import Drawer, { type DrawerProps } from "@/components/Overlays/Drawer";
import Popover from "@/components/Popover/Popover";
import { PartialFor } from "@/utils/types";

const useGlobalOverlayBase = <Props extends ModalProps | DrawerProps>(
  selector: (state: RootState) => Overlay<Props>,
  setStateAction: ActionCreatorWithPayload<Partial<Overlay<Props>>>
) => {
  const dispatch = useAppDispatch();
  const overlay = useAppSelector(selector);

  const openOverlay = React.useCallback(
    ({ content, props }: Omit<Overlay<Props>, "isOpen">) => {
      dispatch(
        setStateAction({
          isOpen: true,
          content,
          props,
        })
      );
    },
    [dispatch, setStateAction]
  );

  const closeOverlay = React.useCallback(() => {
    dispatch(setStateAction({ isOpen: false }));
  }, [dispatch, setStateAction]);

  const clearOverlay = React.useCallback(() => {
    dispatch(
      setStateAction({
        content: null,
        props: {},
      })
    );
  }, [dispatch, setStateAction]);

  return {
    isOpen: overlay.isOpen,
    openOverlay,
    closeOverlay,
    clearOverlay,
    state: overlay,
  };
};

export const useGlobalModal = () => {
  const { clearOverlay, closeOverlay, isOpen, openOverlay, state } =
    useGlobalOverlayBase<ModalProps>(
      (state) => state.overlays.modal,
      setModalState
    );

  return {
    isOpen: isOpen,
    openModal: openOverlay,
    closeModal: closeOverlay,
    clearModal: clearOverlay,
    modalState: state,
  };
};

export const useLocalModal = () => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const openModal = () => {
    setIsOpen(true);
  };
  const closeModal = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    openModal,
    closeModal,
    Modal,
  };
};

export const useGlobalDrawer = () => {
  const { clearOverlay, closeOverlay, isOpen, openOverlay, state } =
    useGlobalOverlayBase<DrawerProps>(
      (state) => state.overlays.drawer,
      setDrawerState
    );

  return {
    isOpen: isOpen,
    openDrawer: openOverlay,
    closeDrawer: closeOverlay,
    clearDrawer: clearOverlay,
    drawerState: state,
  };
};

export const useLocalDrawer = () => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const openDrawer = () => {
    setIsOpen(true);
  };
  const closeDrawer = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    openDrawer,
    closeDrawer,
    Drawer,
  };
};

type PopoverInitialProps = PartialFor<
  React.ComponentPropsWithoutRef<typeof Popover>,
  "open"
>;

export const useLocalPopover = () => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const id = React.useId();
  const isOpen = Boolean(anchorEl);
  // using refs for performance. just keep this in mind whenever you use the hook
  // (e.g. don't wrap the ReadyPopover in React.memo unless you know what you're doing)
  const initialPropsRef = React.useRef<PopoverInitialProps>({});
  const readyPopoverComponentRef =
    React.useRef<React.FC<PopoverInitialProps> | null>(null);

  const openPopover = (e: React.SyntheticEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };
  const closePopover = () => {
    setAnchorEl(null);
  };

  // eslint-disable-next-line
  initialPropsRef.current = {
    open: isOpen,
    id: id,
    anchorEl: anchorEl,
    onClose: closePopover,
  };

  // eslint-disable-next-line
  if (!readyPopoverComponentRef.current) {
    readyPopoverComponentRef.current = ({
      children,
      ...props
    }: PopoverInitialProps) => {
      return (
        <Popover
          open={initialPropsRef.current.open!}
          id={initialPropsRef.current.id}
          anchorEl={initialPropsRef.current.anchorEl}
          onClose={initialPropsRef.current.onClose}
          {...props}
        >
          {children}
        </Popover>
      );
    };
  }

  return {
    isOpen,
    openPopover,
    closePopover,
    id,
    Popover,
    // eslint-disable-next-line
    ReadyPopover: readyPopoverComponentRef.current,
  };
};
