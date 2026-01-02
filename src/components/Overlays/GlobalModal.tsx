import React from "react";

import Modal from "@/components/Overlays/Modal";
import { useGlobalModal } from "@/utils/hooks/useOverlay";

const GlobalModal = () => {
  const { closeModal, isOpen, clearModal, modalState } = useGlobalModal();

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      onExited={clearModal}
      {...modalState.props}
    >
      {modalState.content}
    </Modal>
  );
};

export default GlobalModal;
