import { describe, expect, it } from "vitest";

import { newRef } from "@zendev-lab/spark-invocation";
import { TaskGraph } from "./graph.ts";

describe("TaskGraph creation and recovery", () => {
  it("retains recovery progress and keeps fixed names distinct from ordinary creation", () => {
    const graph = new TaskGraph();
    const project = graph.createProject({ title: "Recovery", description: "Recovery" });
    const input = {
      projectRef: project.ref,
      name: "fixed",
      title: "Checkpoint",
      description: "Resume the checkpoint",
    };
    const ref = newRef("task");
    graph.ensureTask(ref, input);
    graph.claimTask(ref, {
      kind: "main",
      claimedBy: "session:owner",
      sessionId: "owner",
      leaseMs: 60_000,
    });
    const created = graph.createTask(input);
    expect(created.name).not.toBe("fixed");

    const before = graph.snapshot();
    expect(graph.ensureTask(ref, input)).toMatchObject({
      status: "running",
      claim: { claimedBy: "session:owner" },
    });
    expect(() => graph.ensureTask(newRef("task"), input)).toThrow();
    expect(() => graph.ensureTask(ref, { ...input, title: "Different checkpoint" })).toThrow();
    expect(graph.snapshot()).toEqual(before);
  });

  it("keeps legacy TODO seeding specific to ordinary creation", () => {
    const graph = new TaskGraph();
    const project = graph.createProject({ title: "Import", description: "Import" });
    const input = {
      projectRef: project.ref,
      title: "Work",
      description: "Canonical plan",
      todos: [{ content: "Imported step" }],
    };
    expect(graph.createTask(input).plan?.items?.map((item) => item.title)).toEqual([
      "Imported step",
    ]);
    expect(
      graph
        .ensureTask(newRef("task"), { ...input, name: "recovered" })
        .plan?.items?.map((item) => item.title),
    ).toEqual(["Canonical plan"]);
  });
});
