import React, { useRef, useEffect, useMemo } from "react";

import { useScreenHeight } from "@/utils/hooks/useScreenHeight";
import { HorizontalStack } from "@/components/Layout/Containers";
import Skeleton from "@/components/Skeleton/Skeleton";

type UseOnIntersectionChangeOptions = {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number;
  enabled?: boolean;
};

export function useOnIntersectionChange(
  onIntersectionChange: (isVisible: boolean) => void,
  {
    root = null,
    rootMargin = "0px",
    threshold = 0,
    enabled = true,
  }: UseOnIntersectionChangeOptions = {}
) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onIntersectionChangeRef = useRef(onIntersectionChange);
  // eslint-disable-next-line
  onIntersectionChangeRef.current = onIntersectionChange;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        onIntersectionChangeRef.current(entry.isIntersecting);
      },
      { root, rootMargin, threshold }
    );

    io.observe(el);

    return () => io.disconnect();
  }, [enabled, root, rootMargin, threshold]);

  return ref;
}

const SKELETON_CONFIG = {
  AVG_ROW_HEIGHT_PX: 80,
  MIN_ROWS: 1,
  MAX_ROWS: 60,
  WIDTHS: [0.35, 0.55, 0.7, 0.42, 0.62, 0.48, 0.8],
} as const;

const emptyFunc = () => {};

export const MessagesSkeleton = ({
  scrollerEl,
  onIntersectionChange,
  fullHeight,
}: {
  scrollerEl?: HTMLElement | null;
  onIntersectionChange?: (isVisible: boolean) => void;
  fullHeight?: boolean;
}) => {
  const screenHeight = useScreenHeight();

  const rowCount = useMemo(() => {
    const rawCount = Math.ceil(
      screenHeight / (fullHeight ? 1 : 2) / SKELETON_CONFIG.AVG_ROW_HEIGHT_PX
    );
    return Math.min(
      SKELETON_CONFIG.MAX_ROWS,
      Math.max(SKELETON_CONFIG.MIN_ROWS, rawCount)
    );
  }, [screenHeight, fullHeight]);

  const onIntersectionChangeCallback = onIntersectionChange || emptyFunc;
  const ref = useOnIntersectionChange(onIntersectionChangeCallback, {
    root: scrollerEl,
    enabled: Boolean(onIntersectionChange),
    rootMargin: "200px 0px",
    threshold: 0,
  });

  return (
    <div className="p-2" ref={ref}>
      {Array.from({ length: rowCount }).map((_, i) => {
        const widthPercent =
          100 * SKELETON_CONFIG.WIDTHS[i % SKELETON_CONFIG.WIDTHS.length];
        return (
          <HorizontalStack key={i} addClassName="items-center">
            <Skeleton variant="circular" height={50} width={50} />
            <Skeleton
              height={SKELETON_CONFIG.AVG_ROW_HEIGHT_PX}
              width={`${widthPercent}%`}
            />
          </HorizontalStack>
        );
      })}
    </div>
  );
};
