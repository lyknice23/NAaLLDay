#!/usr/bin/env node
/**
 * Vercel's Build Output API needs metadata files in `.vercel/output`:
 * `config.json` and `functions/__server.func/.vc-config.json`.
 *
 * The Nitro 3 Vite preset emits the server bundle and static assets, but some
 * versions leave those two files out. Without them Vercel ignores the output
 * and fails with `STATIC_BUILD_NO_OUT_DIR`. This postbuild step fills only the
 * missing metadata so source deploys and Git deploys remain reproducible.
 */
import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const outputDir = join(process.cwd(), ".vercel", "output");
const functionDir = join(outputDir, "functions", "__server.func");
const serverEntry = join(functionDir, "index.mjs");

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(serverEntry))) {
  console.log("[vercel-output] no Nitro server output; skipping metadata");
  process.exit(0);
}

const configPath = join(outputDir, "config.json");
if (await exists(configPath)) {
  console.log("[vercel-output] config.json already present");
} else {
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        version: 3,
        routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/__server" }],
      },
      null,
      2,
    )}\n`,
  );
  console.log("[vercel-output] wrote config.json");
}

const functionConfigPath = join(functionDir, ".vc-config.json");
if (await exists(functionConfigPath)) {
  console.log("[vercel-output] function config already present");
} else {
  await writeFile(
    functionConfigPath,
    `${JSON.stringify(
      {
        handler: "index.mjs",
        launcherType: "Nodejs",
        shouldAddHelpers: false,
        supportsResponseStreaming: true,
        runtime: "nodejs24.x",
      },
      null,
      2,
    )}\n`,
  );
  console.log("[vercel-output] wrote function config");
}
