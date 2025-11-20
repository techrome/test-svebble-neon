import { configureStore } from "@reduxjs/toolkit";
import overlaysReducer from "./slices/overlays";
import { isDev } from "@/utils/isDev";

export const store = configureStore({
  reducer: {
    overlays: overlaysReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["overlays/setModalState", "overlays/setDrawerState"],
        ignoredPaths: ["overlays.modal.content", "overlays.drawer.content"],
      },
    }),
  devTools: isDev,
});

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
