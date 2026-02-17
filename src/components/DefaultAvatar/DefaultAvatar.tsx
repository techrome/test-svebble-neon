import {
  deepPurple,
  indigo,
  blue,
  cyan,
  teal,
  green,
  lime,
  amber,
  orange,
  pink,
} from "@mui/material/colors";
import { Avatar, AvatarProps } from "@mui/material";
import clsx from "clsx";
import React from "react";
import { hashString32 } from "@/utils/stringUtils";

export const AVATAR_BG_COLORS = [
  deepPurple[500],
  indigo[500],
  blue[600],
  cyan[700],
  teal[600],
  green[700],
  lime[800],
  amber[800],
  orange[800],
  pink[600],
] as const;

export const pickAvatarBgColor = (str: string) => {
  const key = str.trim().toLowerCase();
  const hash = hashString32(key);
  const index =
    ((hash % AVATAR_BG_COLORS.length) + AVATAR_BG_COLORS.length) %
    AVATAR_BG_COLORS.length;
  return AVATAR_BG_COLORS[index];
};

export const avatarInitial = (str: string) => {
  return str.trim()[0].toUpperCase();
};
type Props = AvatarProps & {
  addClassName?: string;
  name?: string | null;
  seed: string;
};

const DefaultAvatar = (props: Props) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [avatarSizePx, setAvatarSizePx] = React.useState<number | null>(null);

  const sx = React.useMemo<Props["sx"]>(() => {
    const bg = pickAvatarBgColor(props.seed);
    return {
      bgcolor: bg,
      color: (theme) => theme.palette.getContrastText(bg),
      fontSize: avatarSizePx ? Math.round(avatarSizePx * 0.5) : undefined,
    };
  }, [props.seed, avatarSizePx]);

  const name = React.useMemo(
    () => avatarInitial(props.name || "?"),
    [props.name]
  );

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const updateAvatarSize = () => {
      const rect = el.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      setAvatarSizePx(size);
    };

    updateAvatarSize();

    const observer = new ResizeObserver(() => updateAvatarSize());
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <Avatar
      ref={ref}
      className={clsx(
        "w-full h-full flex justify-center items-center",
        props.addClassName
      )}
      sx={sx}
      {...props}
    >
      {name}
    </Avatar>
  );
};

export default DefaultAvatar;
