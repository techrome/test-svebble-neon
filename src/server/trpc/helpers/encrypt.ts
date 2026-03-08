import sodium from "libsodium-wrappers";

import { env } from "../../env";

const publicKeyBuffer = Buffer.from(env.ENCRYPTION_PUBLIC_KEY!, "base64url");

export const encryptForDb = async (text: string): Promise<string> => {
  await sodium.ready;

  return Buffer.from(
    sodium.crypto_box_seal(Buffer.from(text, "utf-8"), publicKeyBuffer)
  ).toString("base64url");
};
