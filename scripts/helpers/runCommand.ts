import {
  spawnSync,
  SpawnSyncOptionsWithStringEncoding,
} from "node:child_process";

export const runCommand = (
  cmd: string,
  args: string[],
  opts: SpawnSyncOptionsWithStringEncoding & {
    okCodes?: number[];
  } = { encoding: "utf-8" }
) => {
  const { okCodes = [0], ...spawnOpts } = opts;
  const result = spawnSync(cmd, args, {
    ...spawnOpts,
  });
  if (result.error) {
    throw result.error;
  }

  const status = result.status || 0;
  if (!okCodes.includes(status)) {
    process.exit(status);
  }
  return result;
};
