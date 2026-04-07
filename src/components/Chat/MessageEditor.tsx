import React, { useCallback, useEffect, useRef, useState } from "react";
import AttachFileIcon from "@mui/icons-material/AttachFile";
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

const QuillEditor = dynamic(() => import("@/components/Fields/QuillEditor"), {
  ssr: false,
});

type EditorProps = {
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

type Props<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BasePropsBuilder<EditorProps, TFV, TName>;

const MessageEditor = <TFV extends FieldValues, TName extends FieldPath<TFV>>({
  control,
  name,
  rules,
  autoDisableOnSubmit = false,
  placeholder,
  disabled: disabledProp,
  hideError,
  autoFocus,
}: Props<TFV, TName>) => {
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const reactQuillRef = useRef<ReactQuill | null>(null);

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
  const hasError = hideError ? false : Boolean(error);

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
  }, []);

  return (
    <QuillEditor
      value={field.value}
      onChange={field.onChange}
      isToolbarVisible={isToolbarVisible}
      placeholder={placeholder}
      editorRef={setEditorRef}
      startAccessory={
        <Tooltip title="Attach file">
          <IconButton
            type="button"
            className=""
            onClick={() => {
              // TODO
            }}
          >
            <AttachFileIcon />
          </IconButton>
        </Tooltip>
      }
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
