import React from "react";

import Modal from "@/components/Overlays/Modal";
import { useAppSelector } from "@/redux/hooks";
import { useGlobalModal } from "@/utils/useModal";

const GlobalModal = () => {
  const { closeModal, isOpen, clearModal } = useGlobalModal();

  const globalModal = useAppSelector((state) => state.overlays.modal);

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      onExited={clearModal}
      {...globalModal.props}
    >
      {globalModal.content}
    </Modal>
  );
};

export default GlobalModal;
