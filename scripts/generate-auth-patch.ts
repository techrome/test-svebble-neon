// only run this when you change generated schema and then make tweaks to the actual schema

import fs from "node:fs";

import { runCommand } from "@@/scripts/helpers/runCommand";
import {
  GENERATED_AUTH_FILE,
  PATCH_AUTH_FILE,
  REAL_AUTH_FILE,
} from "@@/scripts/helpers/paths";

const diff = runCommand(
  "git",
  ["--no-pager", "diff", "--no-index", GENERATED_AUTH_FILE, REAL_AUTH_FILE],
  { encoding: "utf-8", okCodes: [0, 1] }
);

const patchText = diff.stdout || "";

fs.writeFileSync(PATCH_AUTH_FILE, patchText, "utf-8");

console.log(`Successfully written patch to path: ${PATCH_AUTH_FILE}`);
