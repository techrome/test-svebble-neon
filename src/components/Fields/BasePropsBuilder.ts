import type {
  Control,
  FieldPath,
  FieldValues,
  RegisterOptions,
} from "react-hook-form";

export type BasePropsBuilder<
  ComponentProps extends object,
  TFV extends FieldValues,
  TName extends FieldPath<TFV>,
> = Omit<ComponentProps, "value" | "onChange" | "name" | "helperText"> & {
  name: TName;
  control: Control<TFV>;
  rules?: RegisterOptions<TFV, TName>;
  autoDisableOnSubmit?: boolean;
  helperText?: React.ReactNode;
  helperTextAlwaysShown?: boolean;
};
