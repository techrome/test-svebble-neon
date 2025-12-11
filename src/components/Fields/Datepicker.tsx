import React from "react";
import {
  DatePicker as MuiDatePicker,
  type DatePickerProps as MuiDatePickerProps,
} from "@mui/x-date-pickers/DatePicker";
import { FieldPath, FieldValues } from "react-hook-form";
import {
  BasePropsBuilderPicker,
  useBaseProps,
} from "@/components/Fields/BasePicker";

type Props<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BasePropsBuilderPicker<MuiDatePickerProps, TFV, TName>;

const DatePicker = <TFV extends FieldValues, TName extends FieldPath<TFV>>(
  props: Props<TFV, TName>
) => {
  const baseProps = useBaseProps<MuiDatePickerProps, TFV, TName>(props);

  return <MuiDatePicker {...baseProps.componentProps} />;
};

export default DatePicker;
