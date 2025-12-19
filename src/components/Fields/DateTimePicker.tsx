import React from "react";
import {
  DateTimePicker as MuiDateTimePicker,
  type DateTimePickerProps as MuiDateTimePickerProps,
} from "@mui/x-date-pickers/DateTimePicker";
import { FieldPath, FieldValues } from "react-hook-form";
import {
  BasePropsBuilderPicker,
  useBaseProps,
} from "@/components/Fields/BasePicker";

type Props<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BasePropsBuilderPicker<MuiDateTimePickerProps, TFV, TName>;

const DateTimePicker = <TFV extends FieldValues, TName extends FieldPath<TFV>>(
  props: Props<TFV, TName>
) => {
  const baseProps = useBaseProps<MuiDateTimePickerProps, TFV, TName>(props);

  return <MuiDateTimePicker {...baseProps.componentProps} />;
};

export default DateTimePicker;
