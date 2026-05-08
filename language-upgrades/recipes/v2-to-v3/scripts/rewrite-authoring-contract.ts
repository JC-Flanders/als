import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadAuthoredSourceExport } from "../../../../alsc/compiler/src/authored-load.ts";

const [, , systemRootArg] = process.argv;

if (!systemRootArg) {
  throw new Error("Usage: rewrite-authoring-contract.ts <system-root>");
}

const systemRoot = resolve(systemRootArg);
const systemConfigPath = join(systemRoot, ".als", "system.ts");

type EntrypointKind = "system" | "module" | "delamain";

const RESERVED_AUTHORING_SPECIFIER = "als:authoring";
const RESERVED_CONTRACTS_SPECIFIER = "als:contracts";
const LEGACY_AUTHORING_IMPORT_PATHS = new Set([
  "./authoring.ts",
  "../../../authoring.ts",
  "../../../../../authoring.ts",
]);
const AUTHORING_HELPERS = new Set(["defineSystem", "defineModule", "defineDelamain"]);

const loadedSystem = loadAuthoredSourceExport(
  systemConfigPath,
  "system",
  "system_config",
  "language_upgrade",
  null,
);
if (!loadedSystem.success || !isRecord(loadedSystem.data)) {
  throw new Error("Could not load .als/system.ts while applying the v2-to-v3 authoring rewrite.");
}

const systemConfig = loadedSystem.data as {
  als_version: number;
  modules: Record<string, { version: number }>;
};

await rewriteAuthoredEntrypoint(systemConfigPath, "system");
for (const [moduleId, moduleConfig] of Object.entries(systemConfig.modules)) {
  const moduleRoot = join(systemRoot, ".als", "modules", moduleId, `v${moduleConfig.version}`);
  await rewriteAuthoredEntrypoint(join(moduleRoot, "module.ts"), "module");

  const delamainsRoot = join(moduleRoot, "delamains");
  for (const delamainName of await readDirectoryNames(delamainsRoot)) {
    await rewriteAuthoredEntrypoint(
      join(delamainsRoot, delamainName, "delamain.ts"),
      "delamain",
    );
  }
}

await rm(join(systemRoot, ".als", "authoring.ts"), { force: true });

async function rewriteAuthoredEntrypoint(
  filePath: string,
  kind: EntrypointKind,
): Promise<void> {
  const current = await readFile(filePath, "utf-8");
  const next = rewriteAuthoredSource(current, kind);
  if (next === current) {
    return;
  }

  await writeFile(filePath, next, "utf-8");
}

function rewriteAuthoredSource(source: string, kind: EntrypointKind): string {
  const authoringSpecifiers = new OrderedSpecifiers();
  const contractSpecifiers = new OrderedSpecifiers();
  const lines = source.split("\n");
  const rewrittenLines: string[] = [];
  let firstImportIndex: number | null = null;

  for (const line of lines) {
    const importMatch = line.match(/^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?\s*$/);
    if (!importMatch) {
      rewrittenLines.push(line);
      continue;
    }

    const [, rawSpecifiers, importPath] = importMatch;
    if (
      importPath !== RESERVED_AUTHORING_SPECIFIER
      && importPath !== RESERVED_CONTRACTS_SPECIFIER
      && !LEGACY_AUTHORING_IMPORT_PATHS.has(importPath)
    ) {
      rewrittenLines.push(line);
      continue;
    }

    if (firstImportIndex === null) {
      firstImportIndex = rewrittenLines.length;
    }

    for (const specifier of rawSpecifiers.split(",").map((value) => value.trim()).filter(Boolean)) {
      if (importPath === RESERVED_CONTRACTS_SPECIFIER) {
        contractSpecifiers.add(specifier);
        continue;
      }

      if (importPath === RESERVED_AUTHORING_SPECIFIER) {
        authoringSpecifiers.add(specifier);
        continue;
      }

      const normalizedSpecifier = specifier.replace(/^type\s+/, "").trim();
      if (AUTHORING_HELPERS.has(normalizedSpecifier)) {
        authoringSpecifiers.add(specifier);
      } else {
        contractSpecifiers.add(specifier);
      }
    }
  }

  if (firstImportIndex !== null) {
    const importLines: string[] = [];
    if (authoringSpecifiers.values.length > 0) {
      importLines.push(
        `import { ${authoringSpecifiers.values.join(", ")} } from "${RESERVED_AUTHORING_SPECIFIER}";`,
      );
    }
    if (contractSpecifiers.values.length > 0) {
      importLines.push(
        `import { ${contractSpecifiers.values.join(", ")} } from "${RESERVED_CONTRACTS_SPECIFIER}";`,
      );
    }
    rewrittenLines.splice(firstImportIndex, 0, ...importLines);
  }

  const rewritten = rewrittenLines.join("\n");
  if (kind !== "system") {
    return rewritten;
  }

  return rewritten.replace(
    /((?:["'])?als_version(?:["'])?\s*:\s*)2\b/,
    "$13",
  );
}

async function readDirectoryNames(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class OrderedSpecifiers {
  values: string[] = [];

  add(value: string): void {
    if (!this.values.includes(value)) {
      this.values.push(value);
    }
  }
}
