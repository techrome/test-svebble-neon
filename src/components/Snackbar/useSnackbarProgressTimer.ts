import React from "react";

export interface UseSnackbarProgressTimerOptions {
  shouldAutoRun?: boolean;
  pauseOnHover?: boolean;
  pauseOnWindowBlur?: boolean;
}

export const useSnackbarProgressTimer = (
  opts: UseSnackbarProgressTimerOptions
) => {
  const {
    shouldAutoRun = true,
    pauseOnHover = true,
    pauseOnWindowBlur = true,
  } = opts;

  const [isRunning, setIsRunning] = React.useState<boolean>(shouldAutoRun);

  const isHoveredRef = React.useRef<boolean>(false);

  const play = React.useCallback(() => {
    if (shouldAutoRun) {
      setIsRunning(true);
    }
  }, [shouldAutoRun]);

  const pause = React.useCallback(() => {
    if (shouldAutoRun) {
      setIsRunning(false);
    }
  }, [shouldAutoRun]);

  React.useEffect(() => {
    if (!pauseOnWindowBlur || !shouldAutoRun) {
      return;
    }

    if (!document.hasFocus()) {
      pause();
    }

    const handleFocus = () => {
      if (!isHoveredRef.current) {
        play();
      }
    };
    const handleBlur = () => pause();

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [pauseOnWindowBlur, shouldAutoRun, play, pause]);

  let eventHandlers: Pick<
    React.DOMAttributes<HTMLDivElement>,
    "onMouseEnter" | "onMouseLeave"
  > = {};

  if (shouldAutoRun && pauseOnHover) {
    eventHandlers.onMouseEnter = () => {
      isHoveredRef.current = true;
      pause();
    };
    eventHandlers.onMouseLeave = () => {
      isHoveredRef.current = false;
      play();
    };
  }

  return {
    isRunning,
    play,
    pause,
    eventHandlers,
  };
};
