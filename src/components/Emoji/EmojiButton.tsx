import dynamic from "next/dynamic";
import { IconButton } from "@mui/material";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import Tooltip from "@/components/Tooltip/Tooltip";

import { useLocalPopover } from "@/utils/hooks/useOverlay";

const EmojiPicker = dynamic(() => import("./EmojiPicker"), {
  ssr: false,
  loading: () => <div className="w-sm" />,
});

type Props = {
  onSelect: (e: string) => void;
};

const EmojiButton = (props: Props) => {
  const popover = useLocalPopover();
  const insertAtCaret = (emoji: string) => {
    props.onSelect(emoji);
  };

  return (
    <>
      <Tooltip title="Add emoji">
        <IconButton type="button" onClick={popover.openPopover}>
          <EmojiEmotionsIcon />
        </IconButton>
      </Tooltip>

      <popover.ReadyComponent
        placement="top-start"
        paperProps={{ className: "rounded-2xl" }}
      >
        <EmojiPicker
          onSelect={(emoji) => {
            insertAtCaret(emoji);
          }}
        />
      </popover.ReadyComponent>
    </>
  );
};

export default EmojiButton;
