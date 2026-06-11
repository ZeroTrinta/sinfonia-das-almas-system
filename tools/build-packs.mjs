/**
 * tools/build-packs.mjs
 * 
 * Compila os JSONs de packs-source/ em Compendium Packs (LevelDB) na pasta packs/.
 * Usa o @foundryvtt/foundryvtt-cli oficial.
 * 
 * Uso:
 *   npm install
 *   npm run build:packs
 */

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import crypto from "node:crypto";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE_DIR = join(ROOT, "packs-source");
const PACKS_DIR  = join(ROOT, "packs");

// Mapeamento: arquivo JSON → nome do pack (deve bater com system.json)
const PACK_MAP = {
  "armas.json":      "armas-nucleo",
  "magias.json":     "magias-nucleo",
  "armaduras.json":  "armaduras-nucleo",
  "conduites.json":  "conduites-nucleo",
  "itens.json":      "itens-nucleo"
};

/** Gera um _id determinístico baseado no nome (consistência entre builds) */
function deterministicId(name) {
  const hash = crypto.createHash("md5").update(name).digest("hex");
  return hash.substring(0, 16);
}

async function buildPack(sourceFile, packName) {
  const sourcePath = join(SOURCE_DIR, sourceFile);
  const packPath = join(PACKS_DIR, packName);

  console.log(`\n📦 Building pack: ${packName}`);
  console.log(`   Source: ${sourceFile}`);

  // Limpa pack antigo se existir
  if (existsSync(packPath)) {
    console.log(`   🗑️  Limpando pack antigo...`);
    await rm(packPath, { recursive: true, force: true });
  }

  // Lê os items do JSON
  const raw = await readFile(sourcePath, "utf-8");
  const items = JSON.parse(raw);

  if (!Array.isArray(items)) {
    throw new Error(`${sourceFile} deve conter um array de items`);
  }
  console.log(`   ${items.length} items a importar`);

  // Cria um diretório temporário com 1 .json por item (formato esperado pela CLI)
  const tempDir = join(os.tmpdir(), `sinfonia-build-${packName}-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  for (const item of items) {
    if (!item._id) item._id = deterministicId(item.name);
    
    item.effects = item.effects ?? [];
    item.flags = item.flags ?? {};
    item.ownership = item.ownership ?? { default: 0 };
    item._stats = item._stats ?? {
      systemId: "sinfonia-das-almas",
      systemVersion: "0.7.7",
      coreVersion: "12",
      createdTime: Date.now(),
      modifiedTime: Date.now(),
      lastModifiedBy: null
    };
    item._key = `!items!${item._id}`;

    // Sanitiza nome para arquivo
    const safeName = item.name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const filename = `${safeName}_${item._id}.json`;
    
    await writeFile(
      join(tempDir, filename),
      JSON.stringify(item, null, 2),
      "utf-8"
    );
  }

  // Compila o pack
  await compilePack(tempDir, packPath, { recursive: false, log: false });

  // Limpa temp
  await rm(tempDir, { recursive: true, force: true });

  console.log(`   ✅ Pack ${packName} compilado em ${packPath}`);
}

async function main() {
  console.log("🏗️  Building Sinfonia das Almas Compendium Packs...");

  if (!existsSync(PACKS_DIR)) {
    await mkdir(PACKS_DIR, { recursive: true });
  }

  const sourceFiles = await readdir(SOURCE_DIR);
  const jsonFiles = sourceFiles.filter(f => f.endsWith(".json"));

  for (const file of jsonFiles) {
    const packName = PACK_MAP[file];
    if (!packName) {
      console.log(`⏭️  Skipping ${file} (não mapeado em PACK_MAP)`);
      continue;
    }
    try {
      await buildPack(file, packName);
    } catch (err) {
      console.error(`❌ Erro ao processar ${file}:`, err.message);
      console.error(err.stack);
      process.exit(1);
    }
  }

  console.log("\n✅ Build completo!");
}

main().catch(err => {
  console.error("❌ Build falhou:", err);
  process.exit(1);
});
