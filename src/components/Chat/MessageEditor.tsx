import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SendIcon from "@mui/icons-material/Send";
import TextFormatIcon from "@mui/icons-material/TextFormat";
import dynamic from "next/dynamic";
import type ReactQuill from "react-quill-new";

import Tooltip from "@/components/Tooltip/Tooltip";
import IconButton from "@/components/Button/IconButton";
import EmojiButton from "@/components/Emoji/EmojiButton";
import {
  useController,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { type BasePropsBuilder } from "@/components/Fields/BasePropsBuilder";
import { Typography } from "@mui/material";
import { useDebouncedValue } from "@/utils/hooks/useDebouncedValue";
import { htmlToText } from "@/utils/htmlToText";
import { useUser } from "@/trpc/hooks/useUser";
import { getMessageContentMaxLength } from "@/utils/validators/client/messages";

const QuillEditor = dynamic(() => import("@/components/Fields/QuillEditor"), {
  ssr: false,
});

const TextCounter = (props: { value: string; maxLength: number }) => {
  const debouncedValue = useDebouncedValue(props.value, 500);

  const counter = useMemo(() => {
    return htmlToText(debouncedValue).length;
  }, [debouncedValue]);

  if (counter < Math.ceil(props.maxLength / 2)) return null;

  return (
    <div className="absolute bottom-0 right-1 pointer-events-none">
      <Typography
        variant="tiny"
        color={counter > props.maxLength ? "error" : "textSecondary"}
      >
        {counter}/{props.maxLength}
      </Typography>
    </div>
  );
};

type EditorProps = {
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  startAccessory?: React.ReactNode;
};

type Props<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BasePropsBuilder<EditorProps, TFV, TName>;

const MessageEditor = <TFV extends FieldValues, TName extends FieldPath<TFV>>({
  control,
  name,
  rules,
  placeholder,
  hideError,
  autoFocus,
  startAccessory,
}: Props<TFV, TName>) => {
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const reactQuillRef = useRef<ReactQuill | null>(null);

  const user = useUser();
  const controller = useController({
    name,
    control,
    rules,
  });

  const field = controller.field;
  const error = controller.fieldState.error;

  // const isSubmitting = controller.formState.isSubmitting;
  // const disabled = autoDisableOnSubmit
  //   ? isSubmitting || disabledProp
  //   : disabledProp;
  const hasError =
    error?.type === "too_big"
      ? Boolean(error)
      : hideError
        ? false
        : Boolean(error);

  const setEditorRef = useCallback(
    (instance: ReactQuill | null) => {
      reactQuillRef.current = instance;

      if (!instance) {
        field.ref(null);
        return;
      }

      field.ref({
        focus: () => {
          const quill = instance.getEditor();
          quill.focus({ preventScroll: true });
          const range = quill.getSelection();
          if (!range) {
            const index = Math.max(quill.getLength() - 1, 0);
            quill.setSelection(index, 0, "silent");
          }
        },
      });
    },
    [field]
  );

  useEffect(() => {
    if (autoFocus) {
      const quill = reactQuillRef.current?.getEditor();
      if (!quill) return;
      requestAnimationFrame(() => {
        quill.focus();
        const index = Math.max(quill.getLength() - 1, 0);
        quill.setSelection(index, 0, "silent");
      });
    }
  }, [autoFocus]);

  return (
    <QuillEditor
      value={field.value}
      onChange={field.onChange}
      isToolbarVisible={isToolbarVisible}
      placeholder={placeholder}
      editorRef={setEditorRef}
      startAccessory={startAccessory}
      endAccessory={
        <>
          <Tooltip
            title={`${isToolbarVisible ? "Hide" : "Show"} formatting options`}
          >
            <IconButton
              type="button"
              onClick={() => {
                setIsToolbarVisible(!isToolbarVisible);
              }}
            >
              <TextFormatIcon />
            </IconButton>
          </Tooltip>
          <EmojiButton
            onSelect={(emoji) => {
              const quill = reactQuillRef.current?.getEditor();
              if (!quill) return;

              const index = quill.getLength() - 1;
              quill.insertText(index, emoji, "user");
              quill.setSelection(index + emoji.length, 0, "silent");
            }}
          />
          <Tooltip title="Send message">
            <IconButton type="submit">
              <SendIcon />
            </IconButton>
          </Tooltip>
          <TextCounter
            value={field.value}
            maxLength={getMessageContentMaxLength(
              user.data?.user?.emailVerified
            )}
          />
        </>
      }
      onSubmitShortcut={() => {
        const form = reactQuillRef.current?.getEditor().root.closest("form");

        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      }}
      helperTextProps={{
        hasError,
        error,
      }}
    />
  );
};

export default MessageEditor;
