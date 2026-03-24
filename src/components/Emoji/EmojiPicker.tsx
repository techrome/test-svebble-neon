import { useEffect, useRef } from "react";
import "emoji-picker-element";

import { useLatest } from "@/utils/hooks/useLatest";
import { alpha, useColorScheme, useMediaQuery, useTheme } from "@mui/material";

type Props = {
  onSelect: (emoji: string) => void;
};

type EmojiClickDetail = {
  unicode: string;
  emoji?: {
    unicode?: string;
  };
};

type PickerStyle = React.CSSProperties & Record<`--${string}`, string | number>;

const EmojiPicker = ({ onSelect }: Props) => {
  const theme = useTheme();
  const { mode } = useColorScheme();
  const compact = useMediaQuery("(max-width:360px)");
  const isDark = mode === "dark";
  const pickerRef = useRef<HTMLElement | null>(null);

  const dependencies = useLatest({
    onSelect,
  });

  useEffect(() => {
    let isEffectCleanup = true;

    if (!isEffectCleanup) return;

    const el = pickerRef.current;
    if (!el) return;

    el.setAttribute("class", isDark ? "dark" : "light");

    const onEmojiClick = (event: Event) => {
      const { onSelect } = dependencies.current;
      console.log("emoji event", event);

      const customEvent = event as CustomEvent<EmojiClickDetail>;
      const emoji =
        customEvent.detail?.unicode ?? customEvent.detail?.emoji?.unicode ?? "";

      if (emoji) {
        onSelect(emoji);
      }
    };

    el.addEventListener("emoji-click", onEmojiClick);

    return () => {
      isEffectCleanup = false;
      el.removeEventListener("emoji-click", onEmojiClick);
    };
    // eslint-disable-next-line
  }, [isDark]);
  let pickerStyle: PickerStyle = {};
  if (theme.vars) {
    pickerStyle = {
      display: "block",
      width: compact ? 320 : 356,
      height: 420,

      // "--background": theme.palette.background.paper,
      // "--border-color": theme.palette.divider,
      // "--border-radius": "16px",
      // "--border-size": "1px",

      // "--button-hover-background": alpha(theme.palette.action.hover, 1),
      // "--button-active-background": alpha(theme.palette.action.selected, 1),

      // "--indicator-color": theme.palette.primary.main,
      // "--indicator-height": "3px",

      "--input-font-color": theme.vars.palette.text.primary,
      "--input-placeholder-color": theme.vars.palette.text.secondary,
      "--input-border-color": theme.vars.palette.divider,
      "--input-border-radius": "10px",
      "--input-border-size": "1px",
      "--input-padding": "8px",

      "--outline-color": theme.vars.palette.primary.main,
      "--outline-size": "2px",

      // "--emoji-size": compact ? "1.3rem" : "1.4rem",
      // "--emoji-padding": compact ? "0.3rem" : "0.35rem",

      // "--category-emoji-size": compact ? "1.05rem" : "1.15rem",
      // "--category-emoji-padding": compact ? "0.25rem" : "0.3rem",

      // "--num-columns": compact ? 7 : 8,
      // "--skintone-border-radius": "999px",
    };
  }

  return <emoji-picker ref={pickerRef} style={pickerStyle} />;
};

export default EmojiPicker;
