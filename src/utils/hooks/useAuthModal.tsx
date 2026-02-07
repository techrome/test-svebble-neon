import React from "react";

import AuthForm, {
  authTypeMapping,
  type AuthType,
} from "@/components/AuthForm/AuthForm";
import { useGlobalModal } from "@/utils/hooks/useOverlay";

export const useAuthModal = () => {
  const authModal = useGlobalModal();

  const openModal = (authType: AuthType) => {
    authModal.openModal({
      content: (
        <AuthForm
          initialAuthType={authType}
          onAuthTypeChange={(newVal) =>
            authModal.updateModal((currentModal) => ({
              props: {
                ...currentModal.props,
                title: authTypeMapping[newVal],
              },
            }))
          }
          onSuccess={authModal.closeModal}
        />
      ),
      props: {
        title: authTypeMapping[authType],
      },
    });
  };

  const closeModal = authModal.closeModal;

  return {
    openModal,
    closeModal,
  };
};
