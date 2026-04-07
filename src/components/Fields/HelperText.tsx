import React from "react";
import { FieldError } from "react-hook-form";
import clsx from "clsx";
import Collapse from "@/components/Collapse/Collapse";
import { FormHelperText, useFormControl } from "@mui/material";

type Props = {
  hasError?: boolean;
  error?: FieldError;
  helperText?: React.ReactNode;
  helperTextAlwaysShown?: boolean;
  isInsideFormHelperText?: boolean;
};

const HelperText = (props: Props) => {
  const muiFormControl = useFormControl();
  const { isInsideFormHelperText = true } = props;

  const collapseComponent = (
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

  if (isInsideFormHelperText) return collapseComponent;
  else
    return (
      <FormHelperText
        component={"div"}
        error={props.hasError}
        focused={muiFormControl?.focused}
        disabled={muiFormControl?.disabled}
        className="mt-0 ml-3.5"
      >
        {collapseComponent}
      </FormHelperText>
    );
};

export default HelperText;
