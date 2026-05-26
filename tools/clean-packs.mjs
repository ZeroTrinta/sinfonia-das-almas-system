/**
 * tools/clean-packs.mjs
 * Remove a pasta packs/ inteira para um rebuild limpo.
 */

import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = join(__dirname, "..", "packs");

if (existsSync(PACKS_DIR)) {
  await rm(PACKS_DIR, { recursive: true, force: true });
  console.log("✅ Pasta packs/ removida");
} else {
  console.log("ℹ️  Pasta packs/ não existe, nada a limpar");
}
