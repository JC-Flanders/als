# ALS Update Deferred Validation Contract

## Status

Proposed

## Context

- `/update` validates an update against live runtime state that started on the old release. For dispatcher-class fixes, Phase 6 drains old in-memory dispatchers before the replacement starts on the new code.
- `runPreparedUpdateTransaction()` also executes the post-commit action manifest from the already-loaded updater process. Moving drain logic from the dispatcher into the updater without a re-exec still leaves the same self-hosting boundary.
- ALS already documents one ad hoc precedent: `als-factory/docs/testing/journeys/update.md` requires a two-version pattern for update-skill changes because the update skill cannot fully prove itself in the same transaction that lands it.
- ALS Factory has no machine-readable contract for this class today. The job schema has no deferred-proof surface, the AAT agent and gate know only `pass`, `fail`, `partial`, and `error`, and the construct failure vocabulary collapses multiple drain incidents into `lifecycle-drain-stalled`.
- Reordering `/update` so new dispatchers start before the old ones drain would regain same-release proof only by sacrificing graceful quiescence and risking termination of in-flight work.

## Decision

- ALS v1 formalizes deferred validation for update self-hosted surfaces instead of reordering `/update` or splitting drain authority across two control planes.
- An update self-hosted surface is any change whose correctness during the update journey is exercised by code already running on the pre-update side of the boundary. v1 examples:
  - dispatcher lifecycle behavior observed during `drain-then-restart`
  - `/update` wrapper or action-runner behavior loaded before Phase 4 and Phase 6 finish
- When `journeys` includes `update` and planning or change-impact determine the touched surface is update self-hosted, the job must carry a structured `## DEFERRED_VALIDATION` record. The record is the auditable replacement for ad hoc prose like "this isn't self-validating."
- The structured record uses one `### {journey} × {platform}` block per pending proof obligation and includes these required bullets:
  - `Status: pending | satisfied | invalidated`
  - `Self-validating: false`
  - `Trigger surfaces: ...`
  - `Expected same-release outcome: pass-deferred`
  - `Expected old-runtime incident kinds: ...`
  - `Proof carrier: next {journey} × {platform} cell whose fixture starts from release {X}`
  - `Satisfied by: ... | null`
  - `Invalidated by: ... | null`
- Same-release AAT may emit `Outcome: pass-deferred` only when all of the following hold:
  - the cell is declared in `## DEFERRED_VALIDATION`
  - the run reached the expected old-runtime boundary
  - the only non-pass signal is one of the declared old-runtime incident kinds
  - no unrelated journey regression surfaced
- `aat-gate` treats `pass-deferred` as releasable but not as completed proof. It may advance only when every cell is `pass` or `pass-deferred`, and every `pass-deferred` cell has a matching `Status: pending` record.
- The next update AAT that starts from the first release carrying the fix must consume the pending record:
  - if the cell passes cleanly on the now-running new runtime, mark the record `satisfied`
  - if a later job changed the same self-hosted surface before proof ran, mark the older record `invalidated` and the newer job owns the new pending record
- A job that never ships never creates a pending proof obligation. Shelved or cancelled work therefore leaves no live deferred-validation record.
- ALS splits `lifecycle-drain-stalled` into finer-grained precise states:
  - `lifecycle-drain-ack-timeout`
  - `lifecycle-drain-heartbeat-stale`
  - `lifecycle-drain-quiescence-timeout`
  - `lifecycle-stop-failed`
  - `lifecycle-start-failed`
  - `lifecycle-partial`
- Expected self-hosting deferral is not itself a lifecycle failure state. It is surfaced at the AAT and job-contract layer through `pass-deferred` plus the deferred-validation record.

## Normative Effect

- Required: same-release proof remains the default. `pass-deferred` is legal only for declared update self-hosted surfaces.
- Required: non-update journeys and self-validating update changes still require plain `pass`.
- Required: planning or change-impact must review any `journeys: update` job whose `targets` intersect `construct:dispatcher` or `skill` for update self-hosted behavior and either open or explicitly reject a deferred-validation record.
- Required: `## DEFERRED_VALIDATION` is the machine-readable ledger for pending proof obligations. Freeform notes in `## AAT` are insufficient.
- Required: `aat-gate` may advance a `pass-deferred` result only when a matching pending record exists.
- Required: the first later AAT that can actually exercise the new runtime must resolve the record to `satisfied` or `invalidated`.
- Required: precise drain failure states distinguish acknowledgement timeout, stale heartbeat, and quiescence timeout instead of overloading `lifecycle-drain-stalled`.
- Allowed: release advancement while proof is pending, as long as the pending record is explicit and all other gates pass.
- Rejected: killing or replacing live dispatchers before graceful drain solely to regain same-release proof.
- Rejected: moving drain authority into the updater while the dispatcher still owns the accept and stop boundary.
- Rejected: silently treating a deferred-proof cell as an ordinary `pass`.

## Compiler Impact

- `nfrith-repos/als/alsc/compiler/src/construct-contracts.ts` and its tests widen the lifecycle literal set to the new precise drain states.
- `nfrith-repos/als/alsc/upgrade-construct/` adds the bounded quiescence failure state and threads precise lifecycle states through the action-runner result.
- `.als/modules/als-factory/v3/module.ts` adds a dedicated `DEFERRED_VALIDATION` section rather than a new ad hoc frontmatter boolean. The required bullet `Self-validating: false` inside that section carries the methodology contract.
- `.als/modules/als-factory/v3/delamains/als-factory-jobs/agents/aat.md` and `aat-gate.md` widen the allowed outcomes to include `pass-deferred` and enforce ledger-matching rules.

## Docs and Fixture Impact

- Update `als-factory/docs/testing/journeys/update.md`, `als-factory/docs/testing/aat-update-cdsk.md`, `als-factory/docs/testing/glossary.md`, and any release-model docs that restate AAT outcome meanings.
- Add fixture examples for:
  - a job carrying a pending `## DEFERRED_VALIDATION` record
  - a same-release AAT cell with `Outcome: pass-deferred`
  - a next-release AAT cell that marks the record `satisfied`
  - a superseded record that becomes `invalidated`
- Update SDR 038 and SDR 039 cross-references so lifecycle-result readers know where deferred proof stops and runtime failure vocabulary begins.

## Alternatives Considered

- Reorder `/update` so new dispatchers restart before the old ones drain.
- Rejected because same-release proof would be bought by terminating or superseding in-flight work, which is worse for parallel scaling than a one-release proof delay.

- Move drain orchestration into `nfrith-repos/als/alsc/upgrade-construct/src/action-runner.ts`.
- Rejected because the running dispatcher still owns the only reliable "stop accepting new work" edge, and the updater itself is already loaded before the plugin update completes. Without a larger re-exec redesign this only moves the self-hosting wall; it does not remove it.

## Non-Goals

- Same-release proof for the first release that carries a self-hosted fix.
- Queue reservation, dispatcher-wide admission control, or broader runtime scheduling redesigns.
- Rewriting `/update` into a multi-process handoff protocol in this job.

## Follow-Up

- Paint `## DEFERRED_VALIDATION` examples and `Outcome: pass-deferred` examples into ALS Factory fixtures before implementation.
- If the operator later wants same-release proof rather than explicit deferred proof, reopen the updater-side redesign only as a larger re-exec plus external drain-authority architecture, not as a narrow patch.
