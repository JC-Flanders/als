export const HARNESS_TARGETS = ["claude", "codex"] as const;

export type HarnessTarget = typeof HARNESS_TARGETS[number];

export interface HarnessRuntimeSpec {
  target: HarnessTarget;
  display_name: string;
  generated_skill_root: string;
  delamain_runtime_root: string;
  system_instruction_path: string;
}

export const HARNESS_RUNTIME_SPECS: Record<HarnessTarget, HarnessRuntimeSpec> = Object.freeze({
  claude: {
    target: "claude",
    display_name: "Claude",
    generated_skill_root: ".claude/skills",
    delamain_runtime_root: ".claude/delamains",
    system_instruction_path: ".als/CLAUDE.md",
  },
  codex: {
    target: "codex",
    display_name: "Codex",
    generated_skill_root: ".agents/skills",
    delamain_runtime_root: ".codex/delamains",
    system_instruction_path: ".als/AGENTS.md",
  },
});

export function isHarnessTarget(value: unknown): value is HarnessTarget {
  return typeof value === "string" && (HARNESS_TARGETS as readonly string[]).includes(value);
}

export function parseHarnessTarget(value: string): HarnessTarget | null {
  return isHarnessTarget(value) ? value : null;
}

export function getHarnessRuntimeSpec(target: HarnessTarget): HarnessRuntimeSpec {
  return HARNESS_RUNTIME_SPECS[target];
}

export function listHarnessRuntimeSpecs(): HarnessRuntimeSpec[] {
  return HARNESS_TARGETS.map((target) => HARNESS_RUNTIME_SPECS[target]);
}

export function formatHarnessTargetList(): string {
  return HARNESS_TARGETS.join("|");
}
