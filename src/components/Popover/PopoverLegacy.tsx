import React, { useId, useRef, useState } from "react";
import { Popover as MuiPopover, PopoverProps, useTheme } from "@mui/material";
import { PartialFor } from "@/utils/types";

export type Props = PopoverProps;

const Popover = ({ children, ...props }: Props) => {
  const theme = useTheme();

  return (
    <MuiPopover
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      transitionDuration={theme.transitions.duration.shortest}
      {...props}
    >
      {children}
    </MuiPopover>
  );
};

type PopoverInitialProps = PartialFor<
  React.ComponentPropsWithoutRef<typeof Popover>,
  "open"
>;

export const useLocalPopoverLegacy = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const id = useId();
  const isOpen = Boolean(anchorEl);
  // using refs for performance. just keep this in mind whenever you use the hook
  // (e.g. don't wrap the ReadyComponent in React.memo unless you know what you're doing)
  const initialPropsRef = useRef<PopoverInitialProps>({});
  const readyComponentRef = useRef<React.FC<PopoverInitialProps> | null>(null);

  const openPopover = (e: React.SyntheticEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };
  const closePopover = () => {
    setAnchorEl(null);
  };

  // eslint-disable-next-line
  initialPropsRef.current = {
    open: isOpen,
    id: id,
    anchorEl: anchorEl,
    onClose: closePopover,
  };

  // eslint-disable-next-line
  if (!readyComponentRef.current) {
    readyComponentRef.current = ({
      children,
      onClose,
      ...props
    }: PopoverInitialProps) => {
      return (
        <Popover
          open={initialPropsRef.current.open!}
          id={initialPropsRef.current.id}
          anchorEl={initialPropsRef.current.anchorEl}
          onClose={(...args) => {
            initialPropsRef.current?.onClose?.(...args);
            onClose?.(...args);
          }}
          {...props}
        >
          {children}
        </Popover>
      );
    };
  }

  return {
    isOpen,
    openPopover,
    closePopover,
    id,
    Popover,
    // eslint-disable-next-line
    ReadyComponent: readyComponentRef.current,
  };
};

export default Popover;
