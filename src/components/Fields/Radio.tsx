import * as React from "react";
import {
  useController,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio as MuiRadio,
  RadioGroup as MuiRadioGroup,
  Typography,
  type FormControlLabelProps,
  type FormControlProps,
  type FormLabelProps,
  type RadioGroupProps,
  type RadioProps,
} from "@mui/material";
import { type BasePropsBuilder } from "@/components/Fields/BasePropsBuilder";
import HelperText from "@/components/Fields/HelperText";

type RadioOption = {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  radioProps?: Omit<
    RadioProps,
    "checked" | "onChange" | "name" | "inputRef" | "value"
  >;
  formControlLabelProps?: Omit<
    FormControlLabelProps,
    "control" | "label" | "value" | "disabled"
  >;
};

type BaseMuiProps = {
  options: RadioOption[];
  radioProps?: Omit<
    RadioProps,
    "checked" | "onChange" | "name" | "inputRef" | "value"
  >;
  radioGroupProps?: Omit<RadioGroupProps, "name" | "value">;
  formControlProps?: Omit<FormControlProps, "error" | "disabled">;
  formLabelProps?: Omit<FormLabelProps, "error" | "disabled">;
};

type Props<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BasePropsBuilder<BaseMuiProps, TFV, TName> & {
  label?: React.ReactNode;
  disabled?: boolean;
};

const RadioGroup = <TFV extends FieldValues, TName extends FieldPath<TFV>>(
  props: Props<TFV, TName>
) => {
  const {
    name,
    control,
    label,
    disabled: disabledProp,
    options,
    radioProps,
    radioGroupProps,
    formControlProps,
    formLabelProps,
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
      variant="standard"
      {...formControlProps}
      error={hasError}
      disabled={disabled}
      className="custom-radio-control"
    >
      {label ? <FormLabel {...formLabelProps}>{label}</FormLabel> : null}

      <MuiRadioGroup
        {...radioGroupProps}
        name={field.name}
        value={field.value || ""}
        onChange={(event, value) => {
          field.onChange(value);
          radioGroupProps?.onChange?.(event, value);
        }}
      >
        {options.map((option, index) => {
          const optionDisabled = disabled || option.disabled;

          return (
            <FormControlLabel
              key={option.value}
              {...option.formControlLabelProps}
              value={option.value}
              disabled={optionDisabled}
              control={
                <MuiRadio
                  {...radioProps}
                  {...option.radioProps}
                  slotProps={{
                    input: { ref: index === 0 ? field.ref : undefined },
                  }}
                  onBlur={field.onBlur}
                />
              }
              label={
                option.description ? (
                  <span className="py-1 block">
                    <Typography component="span">{option.label}</Typography>
                    <Typography
                      component="span"
                      variant="caption"
                      color="textSecondary"
                      className="block"
                    >
                      {option.description}
                    </Typography>
                  </span>
                ) : (
                  option.label
                )
              }
            />
          );
        })}
      </MuiRadioGroup>

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

export default RadioGroup;
