import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";

const passphrase = "very-strong-password";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
    cipher: "aes-256-cbc",
    passphrase,
  },
});

fs.writeFileSync("rsa-keys/public.pem", publicKey, { encoding: "utf8" });
fs.writeFileSync("rsa-keys/private.pem", privateKey, { encoding: "utf8" });

console.log(`RSA keys generated with passphrase ${passphrase}`);
