import sodium from "libsodium-wrappers";
import { db } from "../src/server/db";
import { audit_log } from "../src/server/db/schema";
// import f from "./audit_log.json";

const publicKey = Buffer.from("test1", "base64url");
const privateKey = Buffer.from("test2", "base64url");

async function main() {
  await sodium.ready;

  // const encrypted = sodium.crypto_box_seal(
  //   Buffer.from("test", "utf-8"),
  //   publicKey
  // );

  // console.log("Encrypyed text: ", Buffer.from(encrypted).toString("base64url"));
  // const auditLogRows = await db
  //   .select({ ip_address: audit_log.ip_address })
  //   .from(audit_log);
  let obj: Record<string, number> = {};
  // for (const row of f) {
  //   try {
  //     if (row.ip_address) {
  //       const decrypted = sodium.crypto_box_seal_open(
  //         Buffer.from(row.ip_address, "base64url"),
  //         publicKey,
  //         privateKey
  //       );
  //       const ip_addr = Buffer.from(decrypted).toString("utf-8");
  //       obj[ip_addr] = (obj[ip_addr] || 0) + 1;
  //       // console.log(
  //       //   "Decrypted text: ",
  //       //   Buffer.from(decrypted).toString("utf-8") + " " + row.created_at
  //       // );
  //     }
  //   } catch (_err) {}
  // }
  console.log({ obj });
}

main()
  .catch((err) => {
    console.error("Failed to encrypt", err);
  })
  .finally(() => {
    process.exit(0);
  });
