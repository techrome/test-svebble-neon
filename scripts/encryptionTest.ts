import sodium from "libsodium-wrappers";

const publicKey = Buffer.from("dummy-public-bas64", "base64url");
const privateKey = Buffer.from("dummy-private-bas64", "base64url");

async function main() {
  await sodium.ready;

  // const encrypted = sodium.crypto_box_seal(
  //   Buffer.from("test", "utf-8"),
  //   publicKey
  // );

  // console.log("Encrypyed text: ", Buffer.from(encrypted).toString("base64url"));

  const decrypted = sodium.crypto_box_seal_open(
    Buffer.from("base64string...", "base64url"),
    publicKey,
    privateKey
  );
  console.log("Decrypted text: ", Buffer.from(decrypted).toString("utf-8"));
}

main().catch((err) => {
  console.error("Failed to encrypt", err);
  process.exit(1);
});
