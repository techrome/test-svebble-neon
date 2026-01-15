import React from "react";
import { useRouter } from "next/router";
import {
  OAUTH_DONE,
  type OauthPopupMessage,
} from "@/components/AuthForm/Helpers";

const OauthDone = () => {
  const router = useRouter();

  React.useEffect(() => {
    if (!router.isReady) return;
    const status =
      typeof router.query.status === "string"
        ? (router.query.status as OauthPopupMessage["status"])
        : "";

    const message: OauthPopupMessage = {
      type: OAUTH_DONE,
      status,
    };

    try {
      window.opener?.postMessage(message, window.location.origin);
    } catch (_e) {}

    window.close();
  }, [router]);

  return <div>Logging you in... You can close this window.</div>;
};

export default OauthDone;
