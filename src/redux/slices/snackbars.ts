import React from "react";
import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";
import dayjs from "@/utils/dayjs";
import isNumber from "lodash/isNumber";
import isBoolean from "lodash/isBoolean";

import { PartialFor } from "@/utils/types";
import { toISOString } from "@/utils/timeUtils";
import { reactNodeToText } from "@/utils/reactNodeToText";

export type SnackbarId = string | number;

export type Snackbar = {
  id: SnackbarId;
  variant: "info" | "success" | "warning" | "error";
  message: string;
  details?: React.ReactNode;
  detailsStringified?: string;
  dismissed: boolean;
  createdAt: string;
  isRead: boolean;
  durationMs?: number | undefined;
  persist: boolean;
};

export type SnackbarPayload = PartialFor<
  Omit<Snackbar, "createdAt" | "dismissed" | "isRead" | "detailsStringified">,
  "id" | "variant" | "persist"
>;

export type SnackbarState = {
  items: Snackbar[];
  systemNotifications: Snackbar[];
};

const maxSystemNotifications = 1000;

const initialState: SnackbarState = {
  items: [],
  systemNotifications: [],
};

export const snackbarsSlice = createSlice({
  name: "snackbars",
  initialState,
  reducers: {
    addSnackbar: (state, action: PayloadAction<SnackbarPayload>) => {
      const newSnackbar = {
        id: action.payload.id || nanoid(),
        createdAt: toISOString(dayjs()),
        dismissed: false,
        variant: action.payload.variant || "info",
        durationMs: isNumber(action.payload.durationMs)
          ? action.payload.durationMs
          : 5000,
        persist: isBoolean(action.payload.persist)
          ? action.payload.persist
          : true,
        isRead: false,
        detailsStringified: reactNodeToText(action.payload.details),
        ...action.payload,
      } satisfies Snackbar;
      state.items.push(newSnackbar);

      state.systemNotifications.unshift(newSnackbar);
      if (state.systemNotifications.length > maxSystemNotifications) {
        state.systemNotifications.length = maxSystemNotifications;
      }
    },
    dismissSnackbar: (state, action: PayloadAction<SnackbarId>) => {
      const foundSnackbar = state.items.find(
        (snack) => snack.id === action.payload
      );
      if (foundSnackbar) {
        foundSnackbar.dismissed = true;
      }
    },
    dismissAllSnackbars: (state) => {
      state.items.forEach((snack) => {
        snack.dismissed = true;
      });
    },
    deleteSnackbar: (state, action: PayloadAction<SnackbarId>) => {
      state.items = state.items.filter((snack) => snack.id !== action.payload);
    },
    clearSnackbars: (state) => {
      state.items = [];
    },
    deleteSystemNotification: (state, action: PayloadAction<SnackbarId>) => {
      state.systemNotifications = state.systemNotifications.filter(
        (snack) => snack.id !== action.payload
      );
    },
    deleteAllSystemNotifications: (state) => {
      state.systemNotifications = [];
    },
    readAllSystemNotifications: (state) => {
      state.systemNotifications.forEach((snack) => {
        snack.isRead = true;
      });
    },
  },
});

export const {
  addSnackbar,
  dismissSnackbar,
  deleteSnackbar,
  clearSnackbars,
  dismissAllSnackbars,
  deleteSystemNotification,
  deleteAllSystemNotifications,
  readAllSystemNotifications,
} = snackbarsSlice.actions;

export default snackbarsSlice.reducer;
