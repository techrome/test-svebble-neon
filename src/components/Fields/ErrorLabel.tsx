import React from "react";
import { FieldError } from "react-hook-form";
import clsx from "clsx";
import Collapse from "@/components/Collapse/Collapse";

type Props = {
  hasError: boolean;
  error?: FieldError;
};

const ErrorLabel = (props: Props) => {
  return (
    <Collapse in={props.hasError}>
      <span className={clsx("block transition min-h-5")}>
        {props.error?.message}
      </span>
    </Collapse>
  );
};

export default ErrorLabel;
