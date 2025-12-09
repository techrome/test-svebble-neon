import React from "react";
import { TextField, type TextFieldProps } from "@mui/material";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  type Path,
  type RegisterOptions,
  useController,
  UseControllerReturn,
} from "react-hook-form";
import clsx from "clsx";
import ClearIcon from "@mui/icons-material/Clear";

import IconButton from "@/components/Button/IconButton";

type Props<TFV extends FieldValues, TName extends FieldPath<TFV>> = Omit<
  TextFieldProps,
  "name"
> & {
  name: TName;
  control: Control<TFV>;
  rules?: RegisterOptions<TFV, TName>;
  withHelperText?: boolean;
};

type AccessoryContext<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = Props<TFV, TName> & {
  additionalProps: TextFieldProps;
  setAdditionalProps: React.Dispatch<React.SetStateAction<TextFieldProps>>;
  controller: UseControllerReturn<TFV, Path<TFV>>;
};

type AccessoryCustomRenderer = <
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
>(
  ctx: AccessoryContext<TFV, TName>
) => React.ReactNode;

const ClearButton = <TFV extends FieldValues, TName extends FieldPath<TFV>>(
  props: AccessoryContext<TFV, TName>
) => {
  return props.controller.field.value ? (
    <IconButton
      size="small"
      color="inherit"
      aria-label="clear text"
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => {
        props.controller.field.onChange("");
      }}
    >
      <ClearIcon />
    </IconButton>
  ) : null;
};

const predefinedAccessories = {
  clear: ClearButton,
} satisfies Record<string, AccessoryCustomRenderer>;

type PredefinedAccessories = keyof typeof predefinedAccessories;

type FullProps<TFV extends FieldValues, TName extends FieldPath<TFV>> = Props<
  TFV,
  TName
> & {
  endAccessory?:
    | PredefinedAccessories
    | React.ReactElement
    | AccessoryCustomRenderer;
};

const Input = <TFV extends FieldValues, TName extends FieldPath<TFV>>(
  props: FullProps<TFV, TName>
) => {
  const [additionalProps, setAdditionalProps] = React.useState<TextFieldProps>(
    {}
  );

  const {
    name,
    control,
    rules,
    withHelperText = true,
    endAccessory,
    ...textFieldProps
  } = props;

  const controller = useController({
    name,
    control,
    rules,
  });

  const field = controller.field;
  const error = controller.fieldState.error;

  const hasError = Boolean(error);

  let endAdornment: React.ReactNode = null;
  let accessoryContext: AccessoryContext<TFV, TName> = {
    ...props,
    additionalProps,
    setAdditionalProps,
    controller,
  };
  if (typeof endAccessory === "string") {
    const predefinedAccessoryRenderer: AccessoryCustomRenderer | undefined =
      predefinedAccessories[endAccessory];

    if (predefinedAccessoryRenderer) {
      endAdornment = predefinedAccessoryRenderer(accessoryContext);
    }
  } else if (typeof endAccessory === "function") {
    endAdornment = endAccessory(accessoryContext);
  } else if (endAccessory) {
    endAdornment = endAccessory;
  }

  const { ref, ...fieldProps } = field;

  return (
    <TextField
      {...textFieldProps}
      {...fieldProps}
      {...additionalProps}
      inputRef={ref}
      slotProps={{ input: { endAdornment } }}
      error={hasError}
      helperText={
        withHelperText && (
          <span
            className={clsx(
              "block transition min-h-5",
              hasError ? "opacity-100" : "opacity-0"
            )}
          >
            {hasError ? error?.message : ""}
          </span>
        )
      }
    />
  );
};

export default Input;
