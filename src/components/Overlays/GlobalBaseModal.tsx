import React from "react";

import BaseModal from "@/components/Overlays/BaseModal";
import { useGlobalBaseModal } from "@/utils/hooks/useOverlay";

const GlobalBaseModal = () => {
  const { closeModal, isOpen, clearModal, modalState } = useGlobalBaseModal();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={closeModal}
      onExited={clearModal}
      {...modalState.props}
    >
      {modalState.content}
    </BaseModal>
  );
};

export default GlobalBaseModal;
