import React from "react";
import {
  TimePicker as MuiTimePicker,
  type TimePickerProps as MuiTimePickerProps,
} from "@mui/x-date-pickers/TimePicker";
import { FieldPath, FieldValues } from "react-hook-form";
import {
  BasePropsBuilderPicker,
  useBaseProps,
} from "@/components/Fields/BasePicker";

type Props<
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = BasePropsBuilderPicker<MuiTimePickerProps, TFV, TName>;

const TimePicker = <TFV extends FieldValues, TName extends FieldPath<TFV>>(
  props: Props<TFV, TName>
) => {
  const baseProps = useBaseProps<MuiTimePickerProps, TFV, TName>(props);

  return <MuiTimePicker {...baseProps.componentProps} />;
};

export default TimePicker;
