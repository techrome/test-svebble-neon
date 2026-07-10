import React, { useEffect, useRef } from "react";
import {
  ClickAwayListener,
  Grow,
  Paper,
  Popper as MuiPopper,
  type PopperProps as MuiPopperProps,
  type PaperProps,
  useTheme,
  type GrowProps,
} from "@mui/material";

export type PopperCloseReason = "clickAway" | "escapeKeyDown";

export type Props = Omit<MuiPopperProps, "children"> & {
  children: React.ReactNode;
  onClose?: (
    event: MouseEvent | TouchEvent | KeyboardEvent,
    reason: PopperCloseReason
  ) => void;
  autoFocusSurface?: boolean;
  timeout?: GrowProps["timeout"];
  paperProps?: PaperProps;
};

const Popover = ({
  children,
  open,
  onClose,
  placement = "bottom-start",
  autoFocusSurface = true,
  timeout,
  anchorEl,
  paperProps,
  modifiers = [],
  ...props
}: Props) => {
  const theme = useTheme();

  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !autoFocusSurface) return;

    const raf = requestAnimationFrame(() => {
      const surface = surfaceRef.current;
      if (!surface) return;

      const active = document.activeElement;
      if (active instanceof HTMLElement && surface.contains(active)) {
        return;
      }

      surface.focus();
    });

    return () => cancelAnimationFrame(raf);
  }, [open, autoFocusSurface]);

  return (
    <MuiPopper
      open={open}
      placement={placement}
      transition
      anchorEl={anchorEl}
      modifiers={[
        {
          name: "flip",
          enabled: true,
          options: {
            fallbackPlacements: ["bottom", "left", "top"],
            padding: 8,
            rootBoundary: "viewport",
          },
        },
        ...modifiers,
      ]}
      {...props}
      className="z-[calc(var(--mui-zIndex-modal)+1)] max-w-full"
    >
      {({ TransitionProps }) => (
        <Grow
          {...TransitionProps}
          timeout={timeout ?? theme.transitions.duration.shortest}
        >
          <div>
            <ClickAwayListener
              onClickAway={(event) => {
                if (
                  anchorEl instanceof HTMLElement &&
                  event.target instanceof Node &&
                  anchorEl.contains(event.target)
                ) {
                  return;
                }

                onClose?.(event, "clickAway");
              }}
              mouseEvent="onMouseDown"
              touchEvent="onTouchStart"
            >
              <Paper
                elevation={8}
                ref={surfaceRef}
                tabIndex={-1}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  onClose?.(event.nativeEvent, "escapeKeyDown");
                }}
                {...paperProps}
              >
                {children}
              </Paper>
            </ClickAwayListener>
          </div>
        </Grow>
      )}
    </MuiPopper>
  );
};

export default Popover;
