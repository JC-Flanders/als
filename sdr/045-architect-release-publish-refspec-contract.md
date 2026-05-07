# Architect Release Publish Refspec Contract

## Status

Accepted

## Context

- ALS factory v3 invokes `/als-factory-release-rc` from the `changelog` agent, and that agent runs inside a dispatcher-prepared Ghost worktree whose mounted `nfrith-repos/als` submodule is on a dispatch-named branch rather than on `main`.
- ALS-082's first scheduled `update x cdsk` AAT on 2026-05-07 exposed the failure: the release-bearing commit was pushed to a remote branch named after the dispatch worktree instead of to `origin/main`, so the RC marketplace refreshed `origin/main`, stayed on the previous plugin version, and the fixture never saw the intended release.
- The current architect-side release skills phrase the publish step in terms of the current branch context:
  - `als-factory-release-rc` says to "push the RC source branch"
  - `als-factory-release-stable` says to "push only the destination branch" after a fast-forward merge
- `als-factory/docs/release-model/architect-flow.md` already settles the release-channel mapping:
  - RC is served from `nfrith/als` on `main`
  - stable is served from `nfrith/als@stable`
- This job does not introduce new authored ALS syntax or compiler semantics. It tightens the architect-side release-publish contract so the same wire outcome occurs from the architect's primary checkout, a dispatcher worktree, or any future parallel-dispatch context.

## Decision

- Architect-side skills that publish ALS release commits to remote-tracked branches must use an explicit, non-forced git refspec. The remote destination branch is part of the contract and may not be inferred from the caller's local branch name.
- The RC publish contract is:
  - capture the release-bearing ALS commit during the release-act flow
  - publish that exact source ref to `origin` `refs/heads/main`
  - acceptable source forms are the captured commit SHA or `HEAD` only when the skill first reasserts that `HEAD` is the captured release commit
- The stable publish contract is:
  - complete the documented fast-forward-only merge that advances the stable branch from the validated RC branch
  - publish the post-merge source ref to `origin` `refs/heads/stable`
  - acceptable source forms are the captured post-merge commit SHA, `HEAD` after the checkout+merge, or the checked-out stable branch name, as long as the destination ref remains explicit
- Release skills must fail closed when:
  - the push would be non-fast-forward
  - the release-model docs no longer match the expected RC=`main` / stable=`stable` branch contract
  - the skill cannot identify the source ref it is supposed to publish
- Release-model docs remain the source of truth for channel meaning, marketplace names, and operator workflow. Skills may read those docs to validate context and to report what happened, but they may not use the current local branch name as the release destination.
- A plugin-side helper under `nfrith-repos/als/alsc/` may own the exact git command construction and execution. If used, architect-side skills must call that helper with an explicit source ref and destination branch rather than leaving the push semantics open-ended.

## Normative Effect

- Required: `/als-factory-release-rc` publishes the release-bearing commit to `origin` `refs/heads/main`, regardless of the local branch name or worktree context.
- Required: `/als-factory-release-stable` publishes to `origin` `refs/heads/stable` explicitly after the documented fast-forward-only merge succeeds.
- Required: architect-side release pushes remain non-forced.
- Required: the source side of the push resolves to the intended release commit, not to an arbitrary local branch that happens to be checked out.
- Required: a dispatcher worktree branch name such as `delamain/...` never becomes the remote release-channel branch as a side effect of a release-skill publish.
- Required: failure to fast-forward surfaces as an explicit release-skill failure, not as silent history rewriting.
- Allowed: a shared helper or script to execute the explicit refspec push, as long as the helper itself does not infer the destination from the local branch.
- Allowed: `HEAD` as the source ref when the skill has already proven it points at the intended release commit.
- Rejected: `git push origin <current-branch>` or equivalent behavior that derives the remote destination from the current checkout.
- Rejected: `git push origin main` as the RC fix when the local `main` ref may be absent, stale, or unrelated to the prepared release commit.
- Rejected: fixing RC while leaving stable on the old implicit-push contract.
- Rejected: force-pushing `main` or `stable` as part of the normal release flow.

## Compiler Impact

- No ALS parser, validator, or authored-shape changes are introduced by this SDR.
- Add a plugin-side release-publish primitive under `nfrith-repos/als/alsc/` that accepts an explicit source ref plus destination branch and executes a non-forced `git push origin <source>:refs/heads/<destination>`.
- Add regression coverage under `nfrith-repos/als/alsc/` that:
  - runs the release-publish primitive from a dispatch-named local branch against a local filesystem remote
  - proves `refs/heads/main` or `refs/heads/stable` advances as requested
  - proves the dispatch-named branch is not accidentally published as the release destination
- Keep the release-publish primitive internal to ALS tooling. This job does not add a new operator-facing public CLI surface beyond what the architect-side skills invoke.

## Docs and Fixture Impact

- Add `045-architect-release-publish-refspec-contract.md` as the canonical decision record for architect-side release publishing.
- Update `.als/modules/als-factory/v3/skills/als-factory-release-rc/SKILL.md` so the RC publish step names an explicit destination ref or calls the shared helper with `main` as the destination branch.
- Audit and update `.als/modules/als-factory/v3/skills/als-factory-release-stable/SKILL.md` to the same explicit-destination standard while preserving its operator push gate.
- Add plugin-side regression coverage for the release-publish primitive.
- No canonical shape-language documentation change is required because this job does not change authored ALS syntax.

## Alternatives Considered

- Keep the release skills prompt-only and continue telling the agent to push "the source branch."
- Rejected because the exact failure mode came from that ambiguity in dispatcher-worktree context.

- Fix only `/als-factory-release-rc` and leave `/als-factory-release-stable` on an implicit push.
- Rejected because the same branch-context bug would still exist on the stable publish surface, just behind an operator gate.

- Use `git push origin main` as the RC fix.
- Rejected because it names the correct remote branch but does not pin the source side of the push to the release-bearing commit.

- Force-push the canonical release branches.
- Rejected because the normal ALS release flow is fast-forward-only and should fail closed on divergence.

## Non-Goals

- Changing the two-channel release model.
- Changing the release-headline or changelog-staging rules from SDR 033.
- Adding a new operator-facing release UI.
- Solving the separate dispatcher merge-back defects tracked outside ALS-083.
