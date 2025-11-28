import React from "react";
import { useSnackbar } from "notistack";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  addSnackbar,
  deleteSnackbar,
  dismissSnackbar,
  SnackbarId,
  SnackbarPayload,
} from "@/redux/slices/snackbars";

declare module "notistack" {
  interface OptionsObject {
    details?: string;
    durationMs?: number | undefined;
  }
  interface VariantOverrides {
    default: false;
  }
}

export const SnackbarListener = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.snackbars.items);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const displayedItemKeysRef = React.useRef<SnackbarId[]>([]);

  React.useEffect(() => {
    items.forEach((snack) => {
      if (displayedItemKeysRef.current.includes(snack.id)) {
        if (snack.dismissed) {
          closeSnackbar(snack.id);
        }
        return;
      }

      enqueueSnackbar({
        variant: snack.severity,
        key: snack.id,
        message: snack.message,
        details: snack.details,
        durationMs: snack.autoHideDuration,
        persist: true,
        onClose(event, reason, key) {
          if (key) {
            dispatch(dismissSnackbar(key));
          }
        },
        onExited(node, key) {
          dispatch(deleteSnackbar(key));
          displayedItemKeysRef.current = displayedItemKeysRef.current.filter(
            (x) => x !== key
          );
        },
      });

      displayedItemKeysRef.current.push(snack.id);
    });
  }, [items]);

  return null;
};

export const useAppSnackbar = () => {
  const dispatch = useAppDispatch();

  const addAppSnackbar = (data: SnackbarPayload) => {
    dispatch(addSnackbar(data));
  };

  return { addAppSnackbar };
};
