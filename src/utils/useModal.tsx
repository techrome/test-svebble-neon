import React from "react";

type Props = {
  global?: boolean;
};

const useModal = ({ global = true }: Props) => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const openModal = () => {
    if (global) {
    }
  };
  return null;
};

export default useModal;
