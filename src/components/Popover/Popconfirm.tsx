import React, { useState } from "react";
import { Typography } from "@mui/material";

import { type Props as PopoverProps } from "./Popover";
import { useLocalPopover } from "@/utils/hooks/useOverlay";
import {
  HorizontalStack,
  Section,
  VerticalStack,
} from "@/components/Layout/Containers";
import Button from "@/components/Button/Button";
import useIsDesktop from "@/utils/hooks/useIsDesktop";

const composeMouseHandlers = (
  childHandler?: React.MouseEventHandler<HTMLElement>,
  ownHandler?: React.MouseEventHandler<HTMLElement>
): React.MouseEventHandler<HTMLElement> => {
  return (event) => {
    childHandler?.(event);
    if (event.defaultPrevented) return;
    ownHandler?.(event);
  };
};

type Props = {
  children: React.ReactElement<{
    onClick?: React.MouseEventHandler<HTMLElement>;
  }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
  closeOnConfirm?: boolean;
  allowShiftBypass?: boolean;
  popoverProps?: Omit<
    PopoverProps,
    "open" | "id" | "anchorEl" | "onClose" | "children"
  >;
};

export const Popconfirm = ({
  children,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  disabled,
  closeOnConfirm = true,
  allowShiftBypass = true,
  popoverProps,
}: Props) => {
  const { closePopover, openPopover, ReadyComponent } = useLocalPopover();
  const [isConfirming, setIsConfirming] = useState(false);
  const isDesktop = useIsDesktop();
  const shouldShowShiftBypass = isDesktop && allowShiftBypass;

  const child = React.Children.only(children);

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      await onConfirm?.();

      if (closeOnConfirm) {
        closePopover();
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleTriggerClick: React.MouseEventHandler<HTMLElement> = (event) => {
    if (disabled || isConfirming) return;

    if (shouldShowShiftBypass && event.shiftKey) {
      void handleConfirm();
      return;
    }

    openPopover(event);
  };

  const handleCancel = () => {
    closePopover();
    onCancel?.();
    setIsConfirming(false);
  };

  return (
    <>
      {React.cloneElement(child, {
        onClick: composeMouseHandlers(child.props.onClick, handleTriggerClick),
      })}

      <ReadyComponent {...popoverProps}>
        <Section addClassName="min-w-xs max-w-sm">
          <VerticalStack spacing="xs">
            <Typography>{title}</Typography>

            {Boolean(description) && (
              <Typography variant="body2" color="textSecondary">
                {description}
              </Typography>
            )}

            {shouldShowShiftBypass && (
              <Typography variant="caption" color="textSecondary">
                Tip: hold Shift and click to skip this confirmation.
              </Typography>
            )}

            <HorizontalStack>
              <Button
                variant="contained"
                color="primary"
                onClick={handleConfirm}
                isLoading={isConfirming}
              >
                {confirmText}
              </Button>
              <Button
                variant="contained"
                color="inherit"
                onClick={handleCancel}
              >
                {cancelText}
              </Button>
            </HorizontalStack>
          </VerticalStack>
        </Section>
      </ReadyComponent>
    </>
  );
};

export default Popconfirm;
