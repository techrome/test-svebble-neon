// SnackProgressBar.tsx
import * as React from "react";
import clsx from "clsx";

export interface SnackProgressBarProps {
  durationMs: number;
  isRunning: boolean;
  onComplete: () => void;
  hidden?: boolean;
  className?: string;
  style?: React.CSSProperties;
  rtl?: boolean;
}

export const SnackProgressBar = ({
  durationMs,
  isRunning,
  onComplete,
  hidden,
  className,
  style,
  rtl,
}: SnackProgressBarProps) => {
  const inlineStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...style,
      animationDuration: `${durationMs}ms`,
      animationPlayState: isRunning ? "running" : "paused",
    }),
    [style, durationMs, isRunning]
  );

  const baseClassName = clsx("snackbar-progress", {
    "snackbar-progress-rtl": rtl,
  });

  const fullClassName = clsx(baseClassName, className);

  const handleDone = React.useCallback(() => {
    if (hidden) {
      return;
    }
    onComplete();
  }, [hidden, onComplete]);

  const barProps: Pick<
    React.DOMAttributes<HTMLDivElement>,
    "onAnimationEnd"
  > = {
    onAnimationEnd: handleDone,
  };

  return (
    <div
      className="snackbar-progress-wrapper"
      data-hidden={hidden ? "true" : "false"}
    >
      <div
        role="progressbar"
        aria-hidden={hidden ? "true" : "false"}
        aria-label="notification timer"
        className={fullClassName}
        style={inlineStyle}
        {...barProps}
      />
    </div>
  );
};
