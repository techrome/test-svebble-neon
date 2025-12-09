import React from "react";
import {
  DatePicker as MuiDatePicker,
  type DatePickerProps as MuiDatePickerProps,
} from "@mui/x-date-pickers/DatePicker";
import {
  Control,
  FieldPath,
  FieldValues,
  RegisterOptions,
  useController,
} from "react-hook-form";
import clsx from "clsx";

type Props<TFV extends FieldValues, TName extends FieldPath<TFV>> = Omit<
  MuiDatePickerProps,
  "value" | "onChange" | "name"
> & {
  name: TName;
  control: Control<TFV>;
  rules?: RegisterOptions<TFV, TName>;
  withHelperText?: boolean;
};

const DatePicker = <TFV extends FieldValues, TName extends FieldPath<TFV>>(
  props: Props<TFV, TName>
) => {
  const { name, control, rules, withHelperText = true, ...pickerProps } = props;

  const controller = useController({
    name,
    control,
    rules,
  });

  const field = controller.field;
  const error = controller.fieldState.error;

  const hasError = Boolean(error);

  return (
    <MuiDatePicker
      {...pickerProps}
      value={field.value}
      onChange={field.onChange}
      slotProps={{
        ...pickerProps.slotProps,
        textField: {
          ...pickerProps.slotProps?.textField,
          inputRef: field.ref,
          error: hasError,
          helperText: withHelperText && (
            <span
              className={clsx(
                "block transition min-h-5",
                hasError ? "opacity-100" : "opacity-0"
              )}
            >
              {hasError ? error?.message : ""}
            </span>
          ),
        },
      }}
    />
  );
};

export default DatePicker;
