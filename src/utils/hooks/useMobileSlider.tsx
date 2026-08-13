import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import clsx from "clsx";
import useIsDesktop from "@/utils/hooks/useIsDesktop";

const getHorizontalScrollState = (el: HTMLElement) => {
  const threshold = 1;

  return {
    atStart: el.scrollLeft <= threshold,
    atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - threshold,
  };
};

type Props = {
  jumpDistance?: number;
  updaterDependency?: unknown;
};

const mobileButtonArrowClassName = `z-30 w-5 border-0 absolute inset-y-0 bg-[rgb(var(--mui-palette-text-primaryChannel)/0.5)] flex justify-center items-center transition disabled:opacity-0 disabled:pointer-events-none`;

const useMobileSlider = ({
  jumpDistance = 0.7,
  updaterDependency,
}: Props = {}) => {
  const isDesktop = useIsDesktop();

  const [scrollState, setScrollState] = useState({
    atStart: true,
    atEnd: false,
  });
  const parentRef = useRef<HTMLElement>(null);

  const assignParentRef = useCallback((el: HTMLElement | null) => {
    parentRef.current = el;
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollState(getHorizontalScrollState(event.currentTarget));
  }, []);

  const scroll = useCallback(
    (direction: "left" | "right") => {
      const el = parentRef.current;
      if (!el) return;

      el.scrollBy({
        left:
          direction === "left"
            ? -el.clientWidth * jumpDistance
            : el.clientWidth * jumpDistance,
        behavior: "smooth",
      });
    },
    [jumpDistance]
  );

  useEffect(() => {
    if (parentRef.current) {
      setScrollState(getHorizontalScrollState(parentRef.current));
    }
  }, [updaterDependency]);

  const buttons = useMemo(
    () => ({
      left: (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scroll("left")}
          className={clsx("left-0 rounded-l", mobileButtonArrowClassName)}
          disabled={scrollState.atStart || isDesktop}
        >
          <ArrowForwardIosIcon
            fontSize="inherit"
            className="rotate-180 text-mui-background-default text-xs"
          />
        </button>
      ),
      right: (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scroll("right")}
          className={clsx("right-0 rounded-r", mobileButtonArrowClassName)}
          disabled={scrollState.atEnd || isDesktop}
        >
          <ArrowForwardIosIcon
            fontSize="inherit"
            className="text-mui-background-default text-xs"
          />
        </button>
      ),
    }),
    [scroll, scrollState, isDesktop]
  );

  return useMemo(
    () => ({
      handleScroll,
      parentRef: assignParentRef,
      buttons,
    }),
    [handleScroll, assignParentRef, buttons]
  );
};

export default useMobileSlider;
