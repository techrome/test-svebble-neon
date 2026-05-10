import { useLayoutEffect, useRef, useState } from "react";

const getTextOnlyWidth = (el: HTMLElement, text: string) => {
  const originalText = el.textContent;

  el.textContent = text;
  const textOnlyFullWidth = el.scrollWidth;
  el.textContent = originalText;

  return textOnlyFullWidth;
};

const isTextTruncatedByCSS = (el: HTMLElement, textWithoutDots: string) => {
  const textOnlyFullWidth = getTextOnlyWidth(el, textWithoutDots);
  const visibleWidth = el.clientWidth;

  return visibleWidth < textOnlyFullWidth;
};

export const useIsTextTruncated = <T extends HTMLElement = HTMLElement>(
  textWithoutDots?: string
) => {
  const ref = useRef<T>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !textWithoutDots) return;

    const update = () => {
      const next = isTextTruncatedByCSS(el, textWithoutDots);
      setIsTruncated((prev) => (prev === next ? prev : next));
    };
    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    if (el.parentElement) {
      resizeObserver.observe(el.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [textWithoutDots]);

  return { ref, isTruncated };
};
