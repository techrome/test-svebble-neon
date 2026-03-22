import React, { useCallback, useId, useRef, useState } from "react";
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
import Popover, { Props as PopoverProps } from "@/components/Popover/Popover";
import { PartialFor } from "@/utils/types";

const useGlobalOverlayBase = <Props extends ModalProps | DrawerProps>(
  selector: (state: RootState) => Overlay<Props>,
  setStateAction: ActionCreatorWithPayload<Partial<Overlay<Props>>>
) => {
  const dispatch = useAppDispatch();
  const overlay = useAppSelector(selector);

  const openOverlay = useCallback(
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

  const updateOverlay = useCallback(
    (
      update: (
        currentOverlay: Overlay<Props>
      ) => Partial<Omit<Overlay<Props>, "isOpen">>
    ) => {
      dispatch(setStateAction(update(overlay)));
    },
    [dispatch, setStateAction, overlay]
  );

  const closeOverlay = useCallback(() => {
    dispatch(setStateAction({ isOpen: false }));
  }, [dispatch, setStateAction]);

  const clearOverlay = useCallback(() => {
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
    updateOverlay,
    closeOverlay,
    clearOverlay,
    state: overlay,
  };
};

export const useGlobalModal = () => {
  const {
    clearOverlay,
    closeOverlay,
    isOpen,
    openOverlay,
    updateOverlay,
    state,
  } = useGlobalOverlayBase<ModalProps>(
    (state) => state.overlays.modal,
    setModalState
  );

  return {
    isOpen: isOpen,
    openModal: openOverlay,
    updateModal: updateOverlay,
    closeModal: closeOverlay,
    clearModal: clearOverlay,
    modalState: state,
  };
};

type ModalInitialProps = PartialFor<
  ModalProps,
  "isOpen" | "onClose" | "children"
>;

export const useLocalModal = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const initialPropsRef = useRef<ModalInitialProps>({});
  const readyComponentRef = useRef<React.FC<ModalInitialProps> | null>(null);

  const openModal = () => {
    setIsOpen(true);
  };
  const closeModal = () => {
    setIsOpen(false);
  };

  // eslint-disable-next-line
  initialPropsRef.current = {
    isOpen,
    onClose: closeModal,
  };

  // eslint-disable-next-line
  if (!readyComponentRef.current) {
    readyComponentRef.current = ({
      children,
      onClose,
      ...props
    }: ModalInitialProps) => {
      return (
        <Modal
          isOpen={initialPropsRef.current.isOpen!}
          onClose={(...args) => {
            initialPropsRef.current?.onClose?.(...args);
            onClose?.(...args);
          }}
          {...props}
        >
          {children}
        </Modal>
      );
    };
  }

  return {
    isOpen,
    openModal,
    closeModal,
    Modal,
    // eslint-disable-next-line
    ReadyComponent: readyComponentRef.current,
  };
};

export const useGlobalDrawer = () => {
  const {
    clearOverlay,
    closeOverlay,
    isOpen,
    openOverlay,
    updateOverlay,
    state,
  } = useGlobalOverlayBase<DrawerProps>(
    (state) => state.overlays.drawer,
    setDrawerState
  );

  return {
    isOpen: isOpen,
    openDrawer: openOverlay,
    updateDrawer: updateOverlay,
    closeDrawer: closeOverlay,
    clearDrawer: clearOverlay,
    drawerState: state,
  };
};

export const useLocalDrawer = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

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

type PopoverInitialProps = Omit<
  PopoverProps,
  "open" | "anchorEl" | "id" | "onClose"
> & {
  children?: React.ReactNode;
  onClose?: PopoverProps["onClose"];
};

export const useLocalPopover = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const id = useId();
  const isOpen = Boolean(anchorEl);

  // using refs for performance. just keep this in mind whenever you use the hook
  const initialPropsRef = useRef<{
    open: boolean;
    id: string;
    anchorEl: HTMLElement | null;
    onClose: PopoverProps["onClose"];
  }>({
    open: false,
    id,
    anchorEl: null,
    onClose: undefined,
  });

  const readyComponentRef = useRef<React.FC<PopoverInitialProps> | null>(null);

  const openPopover = (e: React.SyntheticEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const closePopover = () => {
    setAnchorEl(null);
  };

  // eslint-disable-next-line
  initialPropsRef.current = {
    open: isOpen,
    id,
    anchorEl,
    onClose: () => {
      closePopover();
    },
  };

  // eslint-disable-next-line
  if (!readyComponentRef.current) {
    readyComponentRef.current = ({ children, onClose, ...props }) => {
      return (
        <Popover
          open={initialPropsRef.current.open}
          id={initialPropsRef.current.id}
          anchorEl={initialPropsRef.current.anchorEl}
          onClose={(event, reason) => {
            initialPropsRef.current.onClose?.(event, reason);
            onClose?.(event, reason);
          }}
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
    ReadyComponent: readyComponentRef.current,
  };
};
