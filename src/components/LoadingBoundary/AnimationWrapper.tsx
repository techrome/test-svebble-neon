import React from "react";
import clsx from "clsx";

type ChildObserverCallback = (el: HTMLElement) => void;
type AnimationWrapperProps = {
  children: React.ReactNode;
  active?: boolean;
  isOuter?: boolean;
  minH?: boolean;
};

const DELAY_MS = 200;

const useChildMutationObserver = (
  containerRef: React.RefObject<HTMLElement | null>,
  onChange: ChildObserverCallback
) => {
  React.useEffect(() => {
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
  minH,
}: AnimationWrapperProps) => {
  const contentWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const rectRef = React.useRef<SVGRectElement | null>(null);
  const [delayedActive, setDelayedActive] = React.useState(false);

  const copyContentBorderRadius = React.useCallback<ChildObserverCallback>(
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

      const firstChildStyles = firstChild
        ? window.getComputedStyle(firstChild)
        : null;

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

  React.useEffect(() => {
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
    <div className={clsx("rotating-dash-frame", minH && "min-h-0")}>
      <div
        ref={contentWrapperRef}
        className={clsx("dash-frame-content", minH && "min-h-0")}
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
