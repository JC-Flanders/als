# Location-Independent Authoring Materialization Contract

## Status

Proposed

## Context

- ALS systems currently depend on `.als/authoring.ts` imports that point into the plugin tree through filesystem-relative or absolute paths.
- That contract breaks as soon as the system root moves relative to the plugin install. The break already affects AAT fixtures and would affect any edgerunner system evaluated outside the in-bundle reference layout.
- `/update` validates the live system before a `language-upgrade-recipe` can run, and shipped hooks still contain raw `require(".als/system.ts")` load paths. Any replacement must therefore work at pre-validation time and across non-compiler direct-load sites.
- The steady-state contract must stay location-independent, pick up the active plugin version automatically, and avoid tracked machine-local resolver artifacts under operator-owned source.

## Decision

- ALS v3 introduces one canonical tracked `.als/authoring.ts` facade for every system. That facade re-exports authoring helpers from `als:authoring` and compatibility contracts from `als:contracts`.
- `als:authoring` and `als:contracts` are ALS-reserved virtual specifiers. They are resolved only by ALS-owned evaluation paths, which materialize them against the active plugin root before executing authored TypeScript.
- ALS-owned authored-data consumers must use one shared materializer/evaluator contract. This includes compiler validation and projection, update preflight/execute, language-upgrade scripts that load authored data, and shipped hook helpers that currently `require()` `.als/system.ts` directly.
- Legacy relative and absolute shims are accepted only as pre-v3 input. The `v2-to-v3` `language-upgrade-recipe` rewrites them to the canonical v3 facade. New installs, the in-bundle reference system, and foundry output emit only the v3 facade.
- ALS does not solve this contract by generating steady-state resolver artifacts in operator systems. Generated `node_modules` links, `package.json` `imports`, and `.als/alsc` symlinks are rejected as the canonical answer for v3.

## Normative Effect

- Required:
  - Every steady-state ALS system uses the same tracked `.als/authoring.ts` text.
  - ALS-owned loaders bind the facade to the active plugin version at evaluation time without relying on child-process inheritance of `CLAUDE_PLUGIN_ROOT`.
  - `/install`, `/update`, and language-upgrade flows converge systems onto the canonical facade automatically.
- Allowed:
  - ALS may normalize legacy shims in a disposable staging area or temp root solely to validate a pre-v3 system and reach the `v2-to-v3` hop.
  - Third-party tools may load ALS authored data if they call the shared ALS materializer/evaluator instead of ambient Bun module resolution.
- Rejected:
  - Filesystem-relative imports from `.als/authoring.ts` into the plugin tree.
  - Absolute plugin-cache imports committed into authored source.
  - Indefinite steady-state support for legacy shim shapes after the v3 hop.
  - Requiring operator systems to carry tracked machine-local resolver metadata so Bun can find authoring helpers.

## Compiler Impact

- `authored-load.ts` gains the shared materialization boundary that maps the reserved specifiers to the active plugin root before evaluation.
- `validate.ts`, `claude-skills.ts`, language-upgrade scripts, and any other authored-data load sites must route through that shared boundary.
- `contracts.ts` and version support tables must grow the v3 hop if the planner/operator approve the versioned cutover.
- Hook-owned direct-load paths must stop ambient `require(".als/system.ts")` evaluation and instead ask the compiler/shared helper to resolve authored module ownership.

## Docs and Fixture Impact

- `shape-language.md` must teach the canonical `.als/authoring.ts` facade and the supported authored-load boundary.
- `language-upgrades.md` must explain the `v2-to-v3` hop and the input-only status of legacy shims.
- `/install` bootstrap templates, `reference-system/.als/authoring.ts`, foundry output, and retained language-upgrade fixtures must align to the new facade.
- AAT preflight shim rewrite docs/scripts must be removed once external-root validation passes without local duct tape.

## Alternatives Considered

- Static authored DSL with no runtime TypeScript execution. Cleanest long-term boundary, but too broad for this bug because it widens the job into a larger language redesign before the existing break can close.
- Generated resolver metadata in each system root (`node_modules`, `package.json` `imports`, or similar). Works with ambient Bun loading, but reintroduces machine-local refresh state and makes authoring correctness depend on install/update hygiene.
- Productized `.als/alsc` symlink flow. Fastest patch, but it keeps the contract as filesystem ductwork inside authored source and risks committing machine-local plugin pointers.

## Open Questions

- Whether the final reserved specifier spellings stay `als:authoring` and `als:contracts` or use another `als:` pair with the same virtual-loader contract.
- Whether hook direct-load replacement is best exposed as a reusable JS helper, a compiler CLI subcommand, or both.
