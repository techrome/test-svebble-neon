import sodium from "libsodium-wrappers";
import { db } from "../src/server/db";
import { audit_log } from "../src/server/db/schema";

const publicKey = Buffer.from("test1", "base64url");
const privateKey = Buffer.from("test2", "base64url");

async function main() {
  await sodium.ready;

  // const encrypted = sodium.crypto_box_seal(
  //   Buffer.from("test", "utf-8"),
  //   publicKey
  // );

  // console.log("Encrypyed text: ", Buffer.from(encrypted).toString("base64url"));
  const auditLogRows = await db
    .select({ ip_address: audit_log.ip_address })
    .from(audit_log);
  for (const row of auditLogRows) {
    try {
      if (row.ip_address) {
        const decrypted = sodium.crypto_box_seal_open(
          Buffer.from(row.ip_address, "base64url"),
          publicKey,
          privateKey
        );

        console.log(
          "Decrypted text: ",
          Buffer.from(decrypted).toString("utf-8")
        );
      }
    } catch (_err) {}
  }
}

main()
  .catch((err) => {
    console.error("Failed to encrypt", err);
  })
  .finally(() => {
    process.exit(1);
  });
