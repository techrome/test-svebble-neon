import React, { useId, useMemo, useState } from "react";
import ReactQuill, { Quill } from "react-quill-new";
import { Parchment } from "quill";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import clsx from "clsx";

import Tooltip from "@/components/Tooltip/Tooltip";
import { HorizontalStack } from "@/components/Layout/Containers";
import { useLatest } from "@/utils/hooks/useLatest";
import HelperText from "@/components/Fields/HelperText";
import { FormControl } from "@mui/material";

type QuillProps = React.ComponentProps<typeof ReactQuill>;

export type Props = {
  value: NonNullable<QuillProps["value"]>;
  onChange: NonNullable<QuillProps["onChange"]>;
  placeholder?: string;
  className?: string;
  isToolbarVisible?: boolean;
  startAccessory?: React.ReactNode;
  endAccessory?: React.ReactNode;
  editorRef?: React.Ref<ReactQuill | null>;
  allowSubmitShortcut?: boolean;
  onSubmitShortcut?: () => void;
  disabled?: boolean;
  quillProps?: QuillProps;
  helperTextProps?: React.ComponentProps<typeof HelperText>;
};

const quillGlobal = globalThis as typeof globalThis & {
  __spoilerParchmentRegistered?: boolean;
};

if (!quillGlobal.__spoilerParchmentRegistered) {
  const SpoilerAttribute = new Parchment.Attributor("spoiler", "data-spoiler", {
    scope: Parchment.Scope.INLINE,
    whitelist: ["true"],
  });

  Quill.register(SpoilerAttribute, true);
  quillGlobal.__spoilerParchmentRegistered = true;
}

const FORMATS = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strike",
  link: "link",
  list: "list",
  code: "code",
  blockquote: "blockquote",
  spoiler: "spoiler",
} as const;
const formatNames = Object.values(FORMATS);

const toolbarSections: {
  className: string;
  label: string;
  value?: string;
  children?: React.ReactNode;
}[][] = [
  [
    {
      className: `ql-${FORMATS.bold}`,
      label: "Bold",
    },
    {
      className: `ql-${FORMATS.italic}`,
      label: "Italic",
    },
    {
      className: `ql-${FORMATS.underline}`,
      label: "Underline",
    },
    {
      className: `ql-${FORMATS.strike}`,
      label: "Strikethrough",
    },
    {
      className: `ql-${FORMATS.code}`,
      label: "Code",
    },
  ],
  [
    {
      className: `ql-${FORMATS.link}`,
      label: "Link",
    },
  ],
  [
    {
      className: `ql-${FORMATS.blockquote}`,
      label: "Quote",
    },
    {
      className: `ql-${FORMATS.list}`,
      label: "Ordered list",
      value: "ordered",
    },
    {
      className: `ql-${FORMATS.list}`,
      label: "Unordered list",
      value: "bullet",
    },
  ],
  [
    {
      className: `ql-${FORMATS.spoiler}`,
      label: "Spoiler",
      value: "true",
      children: <VisibilityOffIcon />,
    },
  ],
];

function Toolbar({ id, isVisible }: { id: string; isVisible: boolean }) {
  return (
    <div className={isVisible ? "" : "hidden"}>
      <div id={id}>
        {toolbarSections.map((handlers, i) => (
          <span key={i} className="ql-formats">
            {handlers.map((handler, j) => (
              <Tooltip key={j} title={handler.label}>
                <button
                  type="button"
                  className={clsx(handler.className, "text-mui-text-secondary")}
                  aria-label={handler.label}
                  {...("value" in handler ? { value: handler.value } : {})}
                >
                  {handler.children}
                </button>
              </Tooltip>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function QuillEditor({
  value,
  onChange,
  placeholder = "Write text...",
  className,
  isToolbarVisible = true,
  startAccessory,
  endAccessory,
  editorRef,
  allowSubmitShortcut = true,
  onSubmitShortcut,
  disabled,
  quillProps,
  helperTextProps,
}: Props) {
  const reactId = useId();
  const toolbarId = useMemo(() => `quill-toolbar-${reactId}`, [reactId]);
  const [isFocused, setIsFocused] = useState(false);
  const staticDependencies = useLatest({
    onSubmitShortcut,
    isToolbarVisible,
    allowSubmitShortcut,
  });
  const modules = useMemo(
    () => ({
      toolbar: `#${toolbarId}`,
      keyboard: {
        bindings: {
          submitOnEnter: {
            key: "Enter",
            shiftKey: false,
            handler: function () {
              const {
                isToolbarVisible,
                allowSubmitShortcut,
                onSubmitShortcut,
              } = staticDependencies.current;
              if (isToolbarVisible || !allowSubmitShortcut) {
                return true; // default Enter handling by Quill
              }

              onSubmitShortcut?.();
              return false;
            },
          },
        },
      },
    }),
    [toolbarId, staticDependencies]
  );

  return (
    <FormControl
      fullWidth
      error={helperTextProps?.hasError}
      disabled={disabled}
      focused={isFocused}
      variant="outlined"
      className={clsx(
        className,
        "custom-quill-editor",
        isFocused && "custom-quill-editor-focused"
      )}
    >
      <Toolbar id={toolbarId} isVisible={isToolbarVisible} />
      <HorizontalStack
        addClassName="items-start p-1 quill-editor-wrapper"
        spacing="none"
        wrap={false}
      >
        {startAccessory}
        <ReactQuill
          ref={editorRef}
          theme="snow"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          modules={modules}
          formats={formatNames}
          useSemanticHTML={false}
          {...quillProps}
          onFocus={(...args) => {
            setIsFocused(true);
            quillProps?.onFocus?.(...args);
          }}
          onBlur={(...args) => {
            setIsFocused(false);
            quillProps?.onBlur?.(...args);
          }}
        />
        {endAccessory}
      </HorizontalStack>
      <HelperText {...helperTextProps} isInsideFormHelperText={false} />
    </FormControl>
  );
}
