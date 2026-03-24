import dynamic from "next/dynamic";
import { IconButton } from "@mui/material";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import Tooltip from "@/components/Tooltip/Tooltip";

import { useLocalPopover } from "@/utils/hooks/useOverlay";

const EmojiPicker = dynamic(() => import("./EmojiPicker"), {
  ssr: false,
});

type Props = {
  onSelect: (e: string) => void;
};

const EmojiButton = (props: Props) => {
  // const [value, setValue] = useState("");
  // const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const popover = useLocalPopover();
  //const open = Boolean(anchorEl);

  const insertAtCaret = (emoji: string) => {
    //   const el = inputRef.current;

    //   if (!el) {
    //     //setValue((prev) => prev + emoji);
    //     return;
    //   }

    //   const start = el.selectionStart || 0;
    //   //const end = el.selectionEnd ?? value.length;

    // //  const nextValue = value.slice(0, start) + emoji + value.slice(end);
    //   const nextCaret = start + emoji.length;

    //  setValue(nextValue);
    props.onSelect(emoji);
    // requestAnimationFrame(() => {
    //  // el.focus();
    //   el.setSelectionRange(nextCaret, nextCaret);
    // });
  };

  return (
    <>
      <Tooltip title="Add Emoji">
        <IconButton type="button" onClick={popover.openPopover}>
          <EmojiEmotionsIcon />
        </IconButton>
      </Tooltip>

      <popover.ReadyComponent placement="left-end">
        <EmojiPicker
          onSelect={(emoji) => {
            insertAtCaret(emoji);
            //setAnchorEl(null);
          }}
        />
      </popover.ReadyComponent>
    </>
  );
};

export default EmojiButton;
