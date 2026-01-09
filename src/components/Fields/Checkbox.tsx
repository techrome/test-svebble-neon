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
import { type BasePropsBuilder } from "@/components/Fields/BasePropsBuilder";
import HelperText from "@/components/Fields/HelperText";

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
    disabled: disabledProp,
    checkboxProps,
    formControlProps,
    formControlLabelProps,
    autoDisableOnSubmit = false,
  } = props;

  const {
    field,
    fieldState,
    formState: { isSubmitting },
  } = useController({
    name,
    control,
  });
  const disabled = autoDisableOnSubmit
    ? isSubmitting || disabledProp
    : disabledProp;
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

      <FormHelperText>
        <HelperText
          hasError={hasError}
          error={fieldState.error}
          helperText={props.helperText}
          helperTextAlwaysShown={props.helperTextAlwaysShown}
        />
      </FormHelperText>
    </FormControl>
  );
};

export default Checkbox;
