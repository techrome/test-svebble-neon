import fs from "node:fs";
import sodium from "libsodium-wrappers";

async function main() {
  await sodium.ready;

  const { publicKey, privateKey } = sodium.crypto_box_keypair();

  fs.writeFileSync(
    "rsa-keys_example/public.key",
    Buffer.from(publicKey).toString("base64url"),
    "utf8"
  );

  fs.writeFileSync(
    "rsa-keys_example/private.key",
    Buffer.from(privateKey).toString("base64url"),
    "utf8"
  );

  console.log("Created public.key and private.key");
}

main().catch((err) => {
  console.error("Failed to generate keys", err);
  process.exit(1);
});
