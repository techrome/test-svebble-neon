import React from "react";
import { Paper, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import { type RenderedMessage } from "@/components/Chat/Message";
import { HorizontalStack } from "@/components/Layout/Containers";
import { useLocalPopover } from "@/utils/hooks/useOverlay";
import clsx from "clsx";

type Props = {
  message: RenderedMessage;
};

const ReplyCountButton = ({ message }: Props) => {
  const popover = useLocalPopover();

  return (
    <HorizontalStack
      addClassName="pl-3 pr-1 items-center hover:cursor-pointer hover:bg-mui-action-selected"
      fullWidth
      spacing="xs"
      onClick={popover.openPopover}
    >
      <Typography color="textSecondary" className="flex items-center">
        Replies: {message.reply_count}
        <KeyboardArrowDownIcon
          fontSize="small"
          className={clsx("transition", popover.isOpen ? "" : "-rotate-90")}
        />
      </Typography>
      <popover.ReadyComponent>
        <Paper>
          <Typography>Messages</Typography>
          {message.reply_count}
        </Paper>
      </popover.ReadyComponent>
    </HorizontalStack>
  );
};

export default ReplyCountButton;
