import React from "react";
import { FieldError } from "react-hook-form";
import clsx from "clsx";
import Collapse from "@/components/Collapse/Collapse";
import { useFormControl } from "@mui/material";

type Props = {
  hasError: boolean;
  error?: FieldError;
  helperText?: React.ReactNode;
  helperTextAlwaysShown?: boolean;
};

const HelperText = (props: Props) => {
  const muiFormControl = useFormControl();

  return (
    <Collapse
      in={
        props.hasError ||
        (Boolean(props.helperText) &&
          (props.helperTextAlwaysShown || muiFormControl?.focused))
      }
    >
      <span className={clsx("block transition min-h-5")}>
        {props.error?.message || props.helperText}
      </span>
    </Collapse>
  );
};

export default HelperText;
