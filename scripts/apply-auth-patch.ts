import fs from "node:fs";
import { runCommand } from "@@/scripts/helpers/runCommand";
import {
  GENERATED_AUTH_FILE,
  PATCH_AUTH_FILE,
  REAL_AUTH_FILE,
} from "@@/scripts/helpers/paths";

// "git apply" deletes the original file
// so I have to store it temporarily and then put it back
const generatedFileContents = fs.readFileSync(GENERATED_AUTH_FILE);

fs.copyFileSync(GENERATED_AUTH_FILE, REAL_AUTH_FILE);

runCommand("git", ["apply", "--recount", PATCH_AUTH_FILE]);

fs.writeFileSync(GENERATED_AUTH_FILE, generatedFileContents);

console.log(`Successfully applied patch to path: ${PATCH_AUTH_FILE}`);
