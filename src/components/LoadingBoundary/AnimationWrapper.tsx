import React, { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

type ChildObserverCallback = (el: HTMLElement) => void;
type AnimationWrapperProps = {
  children: React.ReactNode;
  active?: boolean;
  isOuter?: boolean;
  addClassName?: string;
};

const DELAY_MS = 200;

const useChildMutationObserver = (
  containerRef: React.RefObject<HTMLElement | null>,
  onChange: ChildObserverCallback
) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let firstNode: Element | null = null;
    let firstObserver: MutationObserver | null = null;

    const detachChildObserver = () => {
      if (firstObserver) {
        firstObserver.disconnect();
        firstObserver = null;
      }
      firstNode = null;
    };

    const attachChildObserver = () => {
      const nextFirst = container.firstElementChild;

      if (nextFirst === firstNode) {
        return;
      }

      detachChildObserver();

      firstNode = nextFirst;

      if (!firstNode) {
        return;
      }

      const opts: MutationObserverInit = {
        attributes: true,
        attributeFilter: ["style", "class"],
        subtree: false,
      };

      if (firstNode) {
        firstObserver = new MutationObserver(() => {
          onChange(container);
        });
        firstObserver.observe(firstNode, opts);
      }
    };

    const parentObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          attachChildObserver();
          onChange(container);
          break;
        }
      }
    });

    parentObserver.observe(container, {
      childList: true,
      subtree: false,
    });

    attachChildObserver();
    onChange(container);

    return () => {
      parentObserver.disconnect();
      detachChildObserver();
    };
  }, [containerRef, onChange]);
};

const AnimationWrapper = ({
  active = false,
  children,
  isOuter,
  addClassName,
}: AnimationWrapperProps) => {
  const contentWrapperRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<SVGRectElement | null>(null);
  const [delayedActive, setDelayedActive] = useState(false);

  const copyContentBorderRadius = useCallback<ChildObserverCallback>(
    (contentWrapperEl) => {
      if (!rectRef.current) {
        return;
      }
      const firstChild = contentWrapperEl.firstElementChild;

      if (!firstChild) {
        rectRef.current.style.rx = "";
        rectRef.current.style.ry = "";
        return;
      }

      const firstChildStyles = window.getComputedStyle(firstChild);

      const borderRadius =
        firstChildStyles?.borderRadius ??
        firstChildStyles?.borderTopLeftRadius ??
        "0px";

      rectRef.current.style.rx = `${borderRadius}`;
      rectRef.current.style.ry = `${borderRadius}`;
    },
    []
  );
  useChildMutationObserver(contentWrapperRef, copyContentBorderRadius);

  useEffect(() => {
    if (active) {
      const timeout = setTimeout(() => {
        setDelayedActive(true);
      }, DELAY_MS);
      return () => {
        clearTimeout(timeout);
      };
    } else {
      setDelayedActive(false);
    }
  }, [active]);

  return (
    <div className={clsx("rotating-dash-frame", addClassName)}>
      <div
        ref={contentWrapperRef}
        className={clsx("dash-frame-content", addClassName)}
      >
        {children}
      </div>
      <svg
        className={clsx("dash-frame-svg", isOuter ? "outer" : "inner")}
        aria-hidden="true"
      >
        <rect
          ref={rectRef}
          className={clsx(
            "dash-frame-stroke",
            delayedActive && "dash-frame-stroke-active"
          )}
        />
      </svg>
    </div>
  );
};

export default AnimationWrapper;
