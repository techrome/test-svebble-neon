import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";

import dayjs from "@/utils/dayjs";
import { PartialFor } from "@/utils/types";

export type SnackbarId = string | number;

export type Snackbar = {
  id: SnackbarId;
  severity: "info" | "success" | "warning" | "error";
  message: string;
  details?: string;
  dismissed: boolean;
  createdAt: string;
  autoHideDuration?: number | undefined;
  persist?: boolean;
};

export type SnackbarPayload = PartialFor<
  Omit<Snackbar, "createdAt" | "dismissed">,
  "id" | "severity"
>;

export type SnackbarState = {
  items: Snackbar[];
};

const initialState: SnackbarState = {
  items: [],
};

export const snackbarsSlice = createSlice({
  name: "snackbars",
  initialState,
  reducers: {
    addSnackbar: (state, action: PayloadAction<SnackbarPayload>) => {
      const newSnackbar = {
        id: action.payload.id || nanoid(),
        createdAt: dayjs().toISOString(),
        dismissed: false,
        severity: action.payload.severity || "info",
        autoHideDuration: action.payload.autoHideDuration || 5000,
        ...action.payload,
      } satisfies Snackbar;
      state.items.push(newSnackbar);
    },
    dismissSnackbar: (state, action: PayloadAction<SnackbarId>) => {
      const foundSnackbar = state.items.find(
        (snack) => snack.id === action.payload
      );
      if (foundSnackbar) {
        foundSnackbar.dismissed = true;
      }
    },
    deleteSnackbar: (state, action: PayloadAction<SnackbarId>) => {
      state.items = state.items.filter((snack) => snack.id !== action.payload);
    },
    clearSnackbars: (state) => {
      state.items = [];
    },
  },
});

export const { addSnackbar, dismissSnackbar, deleteSnackbar, clearSnackbars } =
  snackbarsSlice.actions;

export default snackbarsSlice.reducer;
