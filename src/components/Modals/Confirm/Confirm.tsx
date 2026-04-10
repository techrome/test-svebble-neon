import Button from "@/components/Button/Button";
import { HorizontalStack, VerticalStack } from "@/components/Layout/Containers";
import { Typography } from "@mui/material";
import React from "react";

type Props = {
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

const Confirm = (props: Props) => {
  return (
    <VerticalStack spacing="lg">
      <Typography>{props.message}</Typography>
      <HorizontalStack addClassName="justify-between items-center">
        <Button
          size="large"
          variant="contained"
          color="inherit"
          onClick={props.onCancel}
        >
          Cancel
        </Button>
        <Button
          size="large"
          variant="contained"
          color="primary"
          onClick={props.onConfirm}
        >
          Confirm
        </Button>
      </HorizontalStack>
    </VerticalStack>
  );
};

export default Confirm;
