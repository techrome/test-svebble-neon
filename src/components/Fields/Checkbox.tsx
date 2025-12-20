import * as React from "react";
import {
  useController,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import {
  Checkbox as MuiCheckbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  type CheckboxProps,
  type FormControlLabelProps,
  type FormControlProps,
} from "@mui/material";
import { BasePropsBuilder } from "@/components/Fields/BasePicker";
import clsx from "clsx";

type BaseMuiProps = {
  checkboxProps?: Omit<
    CheckboxProps,
    "checked" | "onChange" | "name" | "inputRef" | "value"
  >;
  formControlProps?: Omit<FormControlProps, "error">;
  formControlLabelProps?: Omit<FormControlLabelProps, "control" | "label">;
};

type Props<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BasePropsBuilder<BaseMuiProps, TFV, TName> & {
  label?: React.ReactNode;
  disabled?: boolean;
};

const Checkbox = <TFV extends FieldValues, TName extends FieldPath<TFV>>(
  props: Props<TFV, TName>
) => {
  const {
    name,
    control,
    label,
    disabled,
    checkboxProps,
    formControlProps,
    formControlLabelProps,
    withHelperText = true,
  } = props;

  const { field, fieldState } = useController({
    name,
    control,
  });

  const errorMessage = fieldState.error?.message;
  const hasError = Boolean(errorMessage);

  return (
    <FormControl
      {...formControlProps}
      error={Boolean(errorMessage)}
      disabled={disabled}
      variant="standard"
    >
      <FormControlLabel
        {...formControlLabelProps}
        label={label}
        control={
          <MuiCheckbox
            {...checkboxProps}
            slotProps={{ input: { ref: field.ref } }}
            name={field.name}
            checked={Boolean(field.value)}
            onBlur={field.onBlur}
            onChange={(event, checked) => {
              field.onChange(checked);
            }}
          />
        }
      />

      {hasError && (
        <FormHelperText>
          <span
            className={clsx(
              "block transition min-h-5",
              hasError ? "opacity-100" : "opacity-0"
            )}
          >
            {hasError ? errorMessage : ""}
          </span>
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default Checkbox;
