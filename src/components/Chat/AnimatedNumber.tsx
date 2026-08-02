import clsx from "clsx";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type AnimatedNumberProps = {
  value: number;
  className?: string;
  durationMs?: number;
};

type Transition = {
  id: number;
  from: number;
  to: number;
  increasing: boolean;
};

type CounterStyles = CSSProperties & {
  "--counter-enter": string;
  "--counter-exit": string;
  "--counter-duration": string;
};

export function AnimatedNumber({
  value,
  className = "",
  durationMs = 200,
}: AnimatedNumberProps) {
  const previousValueRef = useRef(value);
  const transitionIdRef = useRef(0);
  const [transition, setTransition] = useState<Transition | null>(null);

  useLayoutEffect(() => {
    const previousValue = previousValueRef.current;

    if (previousValue === value) return;

    previousValueRef.current = value;
    transitionIdRef.current += 1;

    setTransition({
      id: transitionIdRef.current,
      from: previousValue,
      to: value,
      increasing: value > previousValue,
    });
  }, [value]);

  // Prevent an old transition from briefly rendering when 'value'
  // changes before the layout effect creates the next transition
  const activeTransition = transition?.to === value ? transition : null;

  const style: CounterStyles = {
    "--counter-enter": activeTransition?.increasing ? "100%" : "-100%",
    "--counter-exit": activeTransition?.increasing ? "-100%" : "100%",
    "--counter-duration": `${durationMs}ms`,
  };

  const finishTransition = () => {
    if (!activeTransition) {
      return;
    }

    const completedId = activeTransition.id;

    setTransition((prev) => (prev?.id === completedId ? null : prev));
  };

  return (
    <span className={clsx(`animated-number`, className)} style={style}>
      {activeTransition ? (
        <>
          <span
            key={`old-${activeTransition.id}`}
            className="animated-number__old"
            aria-hidden
          >
            {activeTransition.from}
          </span>

          <span
            key={`new-${activeTransition.id}`}
            className="animated-number__new"
            onAnimationEnd={finishTransition}
          >
            {activeTransition.to}
          </span>
        </>
      ) : (
        <span>{value}</span>
      )}
    </span>
  );
}
