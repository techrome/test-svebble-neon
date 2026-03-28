import React from "react";
import TagIcon from "@mui/icons-material/Tag";
import clsx from "clsx";

import { VerticalStack } from "@/components/Layout/Containers";
import { Typography } from "@mui/material";
import { type RouterOutput } from "@/trpc";

type Props = {
  channel: RouterOutput["channels"]["get"]["items"][number];
  isInsideVirtuoso?: boolean;
};

const ChannelHeader = (props: Props) => {
  return (
    <VerticalStack
      withPadding
      addClassName={clsx(
        "mt-auto",
        props.isInsideVirtuoso && "virtuoso-messages-header"
      )}
    >
      <div className="w-fit rounded-full flex justify-center items-center p-2 bg-mui-action-hover">
        <TagIcon fontSize="large" />
      </div>
      <Typography variant="h4" className="font-bold">
        Welcome to #{props.channel.name}!
      </Typography>
      <Typography>
        This is the start of the #{props.channel.name} channel.
      </Typography>
    </VerticalStack>
  );
};

export default ChannelHeader;
