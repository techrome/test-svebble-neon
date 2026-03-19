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
  popoverProps?: Omit<
    PopoverProps,
    "open" | "id" | "anchorEl" | "onClose" | "children"
  >;
};

export const Popconfirm = ({
  children,
  title,
  description,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  disabled,
  closeOnConfirm = true,
  popoverProps,
}: Props) => {
  const { closePopover, openPopover, ReadyComponent } = useLocalPopover();
  const [isConfirming, setIsConfirming] = useState(false);

  const child = React.Children.only(children);

  const handleTriggerClick: React.MouseEventHandler<HTMLElement> = (event) => {
    if (disabled) return;
    openPopover(event);
  };

  const handleCancel = () => {
    closePopover();
    onCancel?.();
  };

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

  return (
    <>
      {React.cloneElement(child, {
        onClick: composeMouseHandlers(child.props.onClick, handleTriggerClick),
      })}
      <ReadyComponent onClose={closePopover} {...popoverProps}>
        <Section addClassName="min-w-xs">
          <VerticalStack>
            <Typography variant="subtitle2">{title}</Typography>
            {Boolean(description) && (
              <Typography variant="body2" color="textSecondary">
                {description}
              </Typography>
            )}
            <HorizontalStack>
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={handleConfirm}
                isLoading={isConfirming}
              >
                {confirmText}
              </Button>
              <Button
                size="small"
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
