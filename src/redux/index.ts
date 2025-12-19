import { combineReducers, configureStore } from "@reduxjs/toolkit";

import overlays, { overlaysSlice } from "./slices/overlays";
import snackbars, { snackbarsSlice } from "./slices/snackbars";
import { isDev } from "@/utils/isDev";
import { GetObjectPaths } from "@/utils/types";

const rootReducer = combineReducers({
  overlays,
  snackbars,
});

export type RootState = ReturnType<typeof rootReducer>;

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          overlaysSlice.actions.setModalState.type,
          overlaysSlice.actions.setDrawerState.type,
          snackbarsSlice.actions.addSnackbar.type,
        ],
        ignoredPaths: [
          "overlays.modal.content",
          "overlays.drawer.content",
          "snackbars.items",
          "snackbars.systemNotifications",
        ] satisfies GetObjectPaths<RootState>[],
      },
    }),
  devTools: isDev,
});

export type AppDispatch = typeof store.dispatch;
