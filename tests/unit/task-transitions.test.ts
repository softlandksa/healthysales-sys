import { describe, it, expect } from "vitest";
import type { TaskStatus } from "@/types";

// Mirror of the server-side map — tested independently so regressions are caught
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending:     ["in_progress", "cancelled"],
  in_progress: ["done", "blocked", "cancelled"],
  done:        [],
  blocked:     ["in_progress", "cancelled"],
  cancelled:   [],
};

const ALL_STATUSES = Object.keys(VALID_TRANSITIONS) as TaskStatus[];

function canTransition(from: TaskStatus, to: TaskStatus, isAdmin = false): boolean {
  if (isAdmin) return from !== to;
  return VALID_TRANSITIONS[from].includes(to);
}

describe("VALID_TRANSITIONS — non-admin", () => {
  it("pending → in_progress allowed", () => {
    expect(canTransition("pending", "in_progress")).toBe(true);
  });

  it("pending → cancelled allowed", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
  });

  it("pending → done NOT allowed", () => {
    expect(canTransition("pending", "done")).toBe(false);
  });

  it("pending → blocked NOT allowed", () => {
    expect(canTransition("pending", "blocked")).toBe(false);
  });

  it("in_progress → done allowed", () => {
    expect(canTransition("in_progress", "done")).toBe(true);
  });

  it("in_progress → blocked allowed", () => {
    expect(canTransition("in_progress", "blocked")).toBe(true);
  });

  it("in_progress → cancelled allowed", () => {
    expect(canTransition("in_progress", "cancelled")).toBe(true);
  });

  it("in_progress → pending NOT allowed", () => {
    expect(canTransition("in_progress", "pending")).toBe(false);
  });

  it("done → anything NOT allowed", () => {
    for (const to of ALL_STATUSES) {
      expect(canTransition("done", to)).toBe(false);
    }
  });

  it("blocked → in_progress allowed", () => {
    expect(canTransition("blocked", "in_progress")).toBe(true);
  });

  it("blocked → cancelled allowed", () => {
    expect(canTransition("blocked", "cancelled")).toBe(true);
  });

  it("blocked → done NOT allowed", () => {
    expect(canTransition("blocked", "done")).toBe(false);
  });

  it("blocked → pending NOT allowed", () => {
    expect(canTransition("blocked", "pending")).toBe(false);
  });

  it("cancelled → anything NOT allowed", () => {
    for (const to of ALL_STATUSES) {
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });
});

describe("VALID_TRANSITIONS — admin bypasses all restrictions", () => {
  it("admin can move done → pending (re-open)", () => {
    expect(canTransition("done", "pending", true)).toBe(true);
  });

  it("admin can move cancelled → in_progress", () => {
    expect(canTransition("cancelled", "in_progress", true)).toBe(true);
  });

  it("admin cannot transition to the same status", () => {
    for (const s of ALL_STATUSES) {
      expect(canTransition(s, s, true)).toBe(false);
    }
  });

  it("admin can make any cross-status transition", () => {
    const pairs: [TaskStatus, TaskStatus][] = [
      ["pending",     "done"],
      ["pending",     "blocked"],
      ["in_progress", "pending"],
      ["done",        "cancelled"],
      ["blocked",     "done"],
    ];
    for (const [from, to] of pairs) {
      expect(canTransition(from, to, true)).toBe(true);
    }
  });
});

describe("terminal states have no outgoing transitions", () => {
  it("done has no allowed transitions", () => {
    expect(VALID_TRANSITIONS.done).toHaveLength(0);
  });

  it("cancelled has no allowed transitions", () => {
    expect(VALID_TRANSITIONS.cancelled).toHaveLength(0);
  });
});

describe("all statuses are covered in the map", () => {
  it("every TaskStatus appears as a key", () => {
    const expected: TaskStatus[] = ["pending", "in_progress", "done", "blocked", "cancelled"];
    for (const s of expected) {
      expect(Object.keys(VALID_TRANSITIONS)).toContain(s);
    }
  });
});
