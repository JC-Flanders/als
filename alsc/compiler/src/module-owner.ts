import { isAbsolute, normalize, resolve, sep } from "node:path";
import type { SystemConfig } from "./schema.ts";
import { loadSystemValidationContext } from "./validate.ts";

export interface ModuleOwnerResolution {
  status: "found" | "not-found" | "invalid-system";
  module_id: string | null;
  diagnostic: string | null;
}

export function resolveOwningModuleForPath(
  systemRootInput: string,
  filePathInput: string,
): ModuleOwnerResolution {
  const context = loadSystemValidationContext(systemRootInput);
  if (!context.system_config || context.initial_diagnostics.length > 0) {
    return {
      status: "invalid-system",
      module_id: null,
      diagnostic: context.initial_diagnostics[0]?.message
        ?? "Could not load .als/system.ts while resolving module ownership.",
    };
  }

  const relativePath = toSystemRelativePath(context.system_root_abs, filePathInput);
  if (!relativePath) {
    return {
      status: "not-found",
      module_id: null,
      diagnostic: null,
    };
  }

  const moduleId = findOwningModuleId(context.system_config, relativePath);
  return {
    status: moduleId ? "found" : "not-found",
    module_id: moduleId,
    diagnostic: null,
  };
}

function toSystemRelativePath(systemRootAbs: string, filePathInput: string): string | null {
  if (!filePathInput) {
    return null;
  }

  if (isAbsolute(filePathInput)) {
    const absolutePath = resolve(filePathInput);
    const systemRootPrefix = `${systemRootAbs}${sep}`;
    if (absolutePath === systemRootAbs) {
      return ".";
    }
    if (!absolutePath.startsWith(systemRootPrefix)) {
      return null;
    }
    return normalize(absolutePath.slice(systemRootPrefix.length)).replaceAll(sep, "/");
  }

  return normalize(filePathInput).replaceAll(sep, "/").replace(/^\.\//, "");
}

function findOwningModuleId(systemConfig: SystemConfig, relativePath: string): string | null {
  for (const [moduleId, moduleConfig] of Object.entries(systemConfig.modules)) {
    if (relativePath === moduleConfig.path || relativePath.startsWith(`${moduleConfig.path}/`)) {
      return moduleId;
    }
  }

  return null;
}
