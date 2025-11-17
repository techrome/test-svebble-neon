import React from "react";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type Overlay = {
  isOpen: boolean;
  content: React.ReactNode;
  props: object;
};
type ModalState = {
  modal: Overlay;
};
type DrawerState = {
  drawer: Overlay;
};

export type OverlaysState = ModalState & DrawerState;

const initialState: OverlaysState = {
  modal: { content: null, props: {}, isOpen: false },
  drawer: { content: null, props: {}, isOpen: false },
};

export const overlaysSlice = createSlice({
  name: "overlays",
  initialState,
  reducers: {
    setModalState: (state, action: PayloadAction<Overlay>) => {
      state.modal = action.payload;
    },
    setDrawerState: (state, action: PayloadAction<Overlay>) => {
      state.drawer = action.payload;
    },
  },
});

export const { setModalState, setDrawerState } = overlaysSlice.actions;

export default overlaysSlice.reducer;
