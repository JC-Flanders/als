import { expect, test } from "bun:test";
import { resolveOwningModuleForPath } from "../src/module-owner.ts";
import { withFixtureSandbox } from "./helpers/fixture.ts";

test("resolveOwningModuleForPath returns the owning module for mounted records", async () => {
  await withFixtureSandbox("module-owner-mounted-record", async ({ root }) => {
    const resolution = resolveOwningModuleForPath(root, "workspace/backlog/items/ITEM-0001.md");

    expect(resolution).toEqual({
      status: "found",
      module_id: "backlog",
      diagnostic: null,
    });
  });
});

test("resolveOwningModuleForPath reports not-found for paths outside mounted modules", async () => {
  await withFixtureSandbox("module-owner-not-found", async ({ root }) => {
    const resolution = resolveOwningModuleForPath(root, ".als/system.ts");

    expect(resolution).toEqual({
      status: "not-found",
      module_id: null,
      diagnostic: null,
    });
  });
});
