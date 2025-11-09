import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    extends: ["next/core-web-vitals", "next/typescript"],
    rules: { "prefer-const": "off" },
  },
]);
