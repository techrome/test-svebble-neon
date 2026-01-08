import React from "react";
import { TextField, type TextFieldProps } from "@mui/material";
import {
  type FieldPath,
  type FieldValues,
  useController,
  UseControllerReturn,
} from "react-hook-form";
import ClearIcon from "@mui/icons-material/Clear";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

import IconButton from "@/components/Button/IconButton";
import { BasePropsBuilder } from "@/components/Fields/BasePicker";
import Tooltip from "@/components/Tooltip/Tooltip";
import HelperText from "@/components/Fields/HelperText";

type Props<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BasePropsBuilder<TextFieldProps, TFV, TName>;

type AccessoryContext<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = Props<TFV, TName> & {
  additionalProps: TextFieldProps;
  setAdditionalProps: React.Dispatch<React.SetStateAction<TextFieldProps>>;
  controller: UseControllerReturn<TFV, TName>;
};

type AccessoryCustomRenderer = <
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
>(
  ctx: AccessoryContext<TFV, TName>
) => React.ReactNode;

const ClearButton: AccessoryCustomRenderer = (props) => {
  return props.controller.field.value ? (
    <IconButton
      aria-label="clear text"
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => {
        props.controller.field.onChange("");
      }}
      disabled={props.disabled}
    >
      <ClearIcon />
    </IconButton>
  ) : null;
};

const PasswordVisibilityButton: AccessoryCustomRenderer = (props) => {
  const type = props.additionalProps.type || props.type;
  const isPassword = type === "password";
  const helperText = isPassword ? "Show password" : "Hide password";
  return (
    <Tooltip title={helperText}>
      <IconButton
        aria-label={helperText}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={() => {
          props.setAdditionalProps((prev) => ({
            ...prev,
            type: isPassword ? "text" : "password",
          }));
        }}
        disabled={props.disabled}
      >
        {isPassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
      </IconButton>
    </Tooltip>
  );
};

const predefinedAccessories = {
  clear: ClearButton,
  passwordVisibility: PasswordVisibilityButton,
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
    autoDisableOnSubmit = false,
    endAccessory,
    disabled: disabledProp,
    ...textFieldProps
  } = props;

  const controller = useController({
    name,
    control,
    rules,
  });

  const field = controller.field;
  const error = controller.fieldState.error;
  const isSubmitting = controller.formState.isSubmitting;
  const disabled = autoDisableOnSubmit
    ? isSubmitting || disabledProp
    : disabledProp;
  const hasError = Boolean(error);

  let endAdornment: React.ReactNode = null;
  let accessoryContext: AccessoryContext<TFV, TName> = {
    ...props,
    disabled,
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

  if (endAdornment) {
    endAdornment = <div className="pl-2 flex">{endAdornment}</div>;
  }

  const { ref, ...fieldProps } = field;

  return (
    <TextField
      {...textFieldProps}
      {...fieldProps}
      disabled={disabled}
      {...additionalProps}
      inputRef={ref}
      slotProps={{ input: { endAdornment } }}
      error={hasError}
      helperText={
        <HelperText
          hasError={hasError}
          error={error}
          helperText={props.helperText}
          helperTextAlwaysShown={props.helperTextAlwaysShown}
        />
      }
    />
  );
};

export default Input;
