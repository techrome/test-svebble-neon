import React from "react";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { type ModalProps } from "@/components/Overlays/Modal";
import { type DrawerProps } from "@/components/Overlays/Drawer";
import { type BaseModalProps } from "@/components/Overlays/BaseModal";

export type Overlay<Props> = {
  isOpen: boolean;
  content: React.ReactNode;
  props: Partial<Props>;
};

export type OverlaysState = {
  modal: Overlay<ModalProps>;
  baseModal: Overlay<BaseModalProps>;
  drawer: Overlay<DrawerProps>;
};

const initialState: OverlaysState = {
  modal: { content: null, props: {}, isOpen: false },
  baseModal: { content: null, props: {}, isOpen: false },
  drawer: { content: null, props: {}, isOpen: false },
};

export const overlaysSlice = createSlice({
  name: "overlays",
  initialState,
  reducers: {
    setModalState: (
      state,
      action: PayloadAction<Partial<OverlaysState["modal"]>>
    ) => {
      Object.assign(state.modal, action.payload);
    },
    setBaseModalState: (
      state,
      action: PayloadAction<Partial<OverlaysState["baseModal"]>>
    ) => {
      Object.assign(state.baseModal, action.payload);
    },
    setDrawerState: (
      state,
      action: PayloadAction<Partial<OverlaysState["drawer"]>>
    ) => {
      Object.assign(state.drawer, action.payload);
    },
  },
});

export const { setModalState, setDrawerState, setBaseModalState } =
  overlaysSlice.actions;

export default overlaysSlice.reducer;
