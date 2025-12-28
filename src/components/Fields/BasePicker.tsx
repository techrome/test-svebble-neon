import React from "react";
import {
  useController,
  UseControllerReturn,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from "react-hook-form";
import { type DateTimePickerProps } from "@mui/x-date-pickers/DateTimePicker";
import { type DatePickerProps } from "@mui/x-date-pickers/DatePicker";
import { type TimePickerProps } from "@mui/x-date-pickers/TimePicker";
import ClearIcon from "@mui/icons-material/Clear";

import IconButton from "@/components/Button/IconButton";
import { InputAdornment, InputAdornmentProps } from "@mui/material";
import ErrorLabel from "@/components/Fields/ErrorLabel";

export type BasePropsBuilder<
  ComponentProps extends object,
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = Omit<ComponentProps, "value" | "onChange" | "name"> & {
  name: TName;
  control: Control<TFV>;
  rules?: RegisterOptions<TFV, TName>;
  withHelperText?: boolean;
  autoDisableOnSubmit?: boolean;
};

type AnyPickerProps = DateTimePickerProps | DatePickerProps | TimePickerProps;

type BaseProps<
  TMuiProps extends AnyPickerProps,
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BasePropsBuilder<TMuiProps, TFV, TName>;

type CustomAdornmentProps = InputAdornmentProps & {
  endAdornment: React.ReactNode;
};

const PickerInputAdornment = (props: CustomAdornmentProps) => {
  const { children, endAdornment, position, ...rest } = props;

  return (
    <InputAdornment position={position || "end"} {...rest}>
      {endAdornment}
      {children}
    </InputAdornment>
  );
};

type AccessoryContext<
  TMuiProps extends AnyPickerProps,
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BaseProps<TMuiProps, TFV, TName> & {
  additionalProps: Partial<TMuiProps>;
  setAdditionalProps: React.Dispatch<React.SetStateAction<Partial<TMuiProps>>>;
  controller: UseControllerReturn<TFV, TName>;
};

type AccessoryCustomRenderer = <
  TMuiProps extends AnyPickerProps,
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
>(
  ctx: AccessoryContext<TMuiProps, TFV, TName>
) => React.ReactNode;

const ClearButton: AccessoryCustomRenderer = (props) => {
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
        props.controller.field.onChange(null);
      }}
    >
      <ClearIcon />
    </IconButton>
  ) : null;
};

const predefinedAccessories = {
  clear: ClearButton,
};

type PredefinedAccessories = keyof typeof predefinedAccessories;

type FullProps<
  TMuiProps extends AnyPickerProps,
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BaseProps<TMuiProps, TFV, TName> & {
  endAccessory?:
    | false
    | PredefinedAccessories
    | React.ReactElement
    | AccessoryCustomRenderer;
};

export type BasePropsBuilderPicker<
  TMuiProps extends AnyPickerProps,
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = FullProps<TMuiProps, TFV, TName>;

export const useBaseProps = <
  TMuiProps extends AnyPickerProps,
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
>(
  props: FullProps<TMuiProps, TFV, TName>
) => {
  const [additionalProps, setAdditionalProps] = React.useState<
    Partial<TMuiProps>
  >({});

  const {
    name,
    control,
    rules,
    autoDisableOnSubmit = false,
    endAccessory = "clear",
    disabled: disabledProp,
    ...pickerProps
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
  let accessoryContext: AccessoryContext<TMuiProps, TFV, TName> = {
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

  return {
    componentProps: {
      ...pickerProps,
      ...fieldProps,
      disabled,
      slots: {
        inputAdornment: PickerInputAdornment,
      },
      slotProps: {
        ...pickerProps.slotProps,
        inputAdornment: { endAdornment },
        textField: {
          ...pickerProps.slotProps?.textField,
          inputRef: ref,
          error: hasError,
          helperText: <ErrorLabel hasError={hasError} error={error} />,
        },
      },
    } satisfies typeof pickerProps & typeof fieldProps,
    controller,
  };
};
