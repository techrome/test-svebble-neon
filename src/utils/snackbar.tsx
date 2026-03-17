import React, { useEffect, useRef } from "react";
import { useSnackbar } from "notistack";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  addSnackbar,
  deleteSnackbar,
  dismissSnackbar,
  SnackbarId,
  SnackbarPayload,
  dismissAllSnackbars,
} from "@/redux/slices/snackbars";

declare module "notistack" {
  interface OptionsObject {
    details?: React.ReactNode;
    detailsStringified?: string;
    durationMs?: number | undefined;
    createdAt?: string;
  }
  interface VariantOverrides {
    default: false;
  }
}

export const SnackbarListener = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.snackbars.items);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const displayedItemKeysRef = useRef<Set<SnackbarId>>(new Set());

  useEffect(() => {
    const handleSnackbarExit = (key: SnackbarId) => {
      dispatch(deleteSnackbar(key));
      displayedItemKeysRef.current.delete(key);
    };
    items.forEach((snack) => {
      if (displayedItemKeysRef.current.has(snack.id)) {
        if (snack.dismissed) {
          closeSnackbar(snack.id);
          handleSnackbarExit(snack.id);
        }
        return;
      }

      enqueueSnackbar({
        variant: snack.variant,
        key: snack.id,
        message: snack.message,
        details: snack.details,
        durationMs: snack.durationMs,
        persist: true,
        onClose(event, reason, key) {
          if (key) {
            dispatch(dismissSnackbar(key));
          }
        },
        onExited(node, key) {
          handleSnackbarExit(key);
        },
      });

      displayedItemKeysRef.current.add(snack.id);
    });
    // eslint-disable-next-line
  }, [items]);

  return null;
};

export const useAppSnackbar = () => {
  const dispatch = useAppDispatch();
  const { closeSnackbar } = useSnackbar();

  const addAppSnackbar = (data: SnackbarPayload) => {
    dispatch(addSnackbar(data));
  };
  const closeAppSnackbar = (id: SnackbarId) => {
    closeSnackbar(id);
  };
  const dismissAllAppSnackbars = () => {
    dispatch(dismissAllSnackbars());
  };

  return { addAppSnackbar, closeAppSnackbar, dismissAllAppSnackbars };
};
