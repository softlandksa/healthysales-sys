import { describe, it, expect } from "vitest";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import type { SessionUser } from "@/types";

function makeUser(role: SessionUser["role"], overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: `user-${role}`,
    name: `Test ${role}`,
    email: `${role}@example.com`,
    role,
    teamId: null,
    managerId: null,
    ...overrides,
  };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

describe("admin", () => {
  const ability = defineAbilitiesFor(makeUser("admin"));

  it("can manage all subjects", () => {
    expect(ability.can("manage", "all")).toBe(true);
  });

  it("can create users", () => expect(ability.can("create", "User")).toBe(true));
  it("can delete teams", () => expect(ability.can("delete", "Team")).toBe(true));
  it("can read AuditLog", () => expect(ability.can("read", "AuditLog")).toBe(true));
});

// ─── General Manager ──────────────────────────────────────────────────────────

describe("general_manager", () => {
  const ability = defineAbilitiesFor(makeUser("general_manager"));

  it("can create users", () => expect(ability.can("create", "User")).toBe(true));
  it("can manage teams", () => expect(ability.can("manage", "Team")).toBe(true));
  it("can read audit logs", () => expect(ability.can("read", "AuditLog")).toBe(true));
  it("cannot delete users", () => expect(ability.can("delete", "User")).toBe(false));
  it("can manage targets", () => expect(ability.can("manage", "Target")).toBe(true));
  it("can read reports", () => expect(ability.can("read", "Report")).toBe(true));
});

// ─── Sales Manager ────────────────────────────────────────────────────────────

describe("sales_manager", () => {
  const ability = defineAbilitiesFor(makeUser("sales_manager"));

  it("can read and create users", () => {
    expect(ability.can("read", "User")).toBe(true);
    expect(ability.can("create", "User")).toBe(true);
  });
  it("can manage teams", () => expect(ability.can("manage", "Team")).toBe(true));
  it("can manage customers", () => expect(ability.can("manage", "Customer")).toBe(true));
  it("can manage visits", () => expect(ability.can("manage", "Visit")).toBe(true));
  it("cannot manage AuditLog", () => expect(ability.can("manage", "AuditLog")).toBe(false));
  it("can read targets", () => expect(ability.can("read", "Target")).toBe(true));
});

// ─── Team Manager ─────────────────────────────────────────────────────────────

describe("team_manager", () => {
  const ability = defineAbilitiesFor(makeUser("team_manager", { teamId: "team-1" }));

  it("can read users", () => expect(ability.can("read", "User")).toBe(true));
  it("can update users", () => expect(ability.can("update", "User")).toBe(true));
  it("cannot create users", () => expect(ability.can("create", "User")).toBe(false));
  it("cannot delete users", () => expect(ability.can("delete", "User")).toBe(false));
  it("can manage visits", () => expect(ability.can("manage", "Visit")).toBe(true));
  it("can manage tasks", () => expect(ability.can("manage", "Task")).toBe(true));
  it("cannot manage AuditLog", () => expect(ability.can("manage", "AuditLog")).toBe(false));
  it("can read reports", () => expect(ability.can("read", "Report")).toBe(true));
});

// ─── Sales Rep ────────────────────────────────────────────────────────────────

describe("sales_rep", () => {
  const ability = defineAbilitiesFor(makeUser("sales_rep", { teamId: "team-1" }));

  it("can read users (own profile)", () => expect(ability.can("read", "User")).toBe(true));
  it("cannot create users", () => expect(ability.can("create", "User")).toBe(false));
  it("cannot delete users", () => expect(ability.can("delete", "User")).toBe(false));
  it("can manage own visits", () => expect(ability.can("manage", "Visit")).toBe(true));
  it("can read tasks", () => expect(ability.can("read", "Task")).toBe(true));
  it("can update tasks", () => expect(ability.can("update", "Task")).toBe(true));
  it("cannot create tasks", () => expect(ability.can("create", "Task")).toBe(false));
  it("cannot delete tasks", () => expect(ability.can("delete", "Task")).toBe(false));
  it("can create orders", () => expect(ability.can("create", "SalesOrder")).toBe(true));
  it("cannot delete orders", () => expect(ability.can("delete", "SalesOrder")).toBe(false));
  it("can read customers", () => expect(ability.can("read", "Customer")).toBe(true));
  it("cannot manage customers", () => expect(ability.can("manage", "Customer")).toBe(false));
  it("cannot read AuditLog", () => expect(ability.can("read", "AuditLog")).toBe(false));
  it("cannot manage teams", () => expect(ability.can("manage", "Team")).toBe(false));
});

// ─── Role hierarchy enforcement ───────────────────────────────────────────────

describe("role hierarchy enforcement", () => {
  it("sales_rep has fewer permissions than team_manager", () => {
    const repAbility = defineAbilitiesFor(makeUser("sales_rep"));
    const tmAbility  = defineAbilitiesFor(makeUser("team_manager"));
    // team_manager can update users, sales_rep cannot
    expect(tmAbility.can("update", "User")).toBe(true);
    expect(repAbility.can("update", "User")).toBe(false);
  });

  it("team_manager has fewer permissions than sales_manager", () => {
    const tmAbility = defineAbilitiesFor(makeUser("team_manager"));
    const smAbility = defineAbilitiesFor(makeUser("sales_manager"));
    expect(smAbility.can("create", "User")).toBe(true);
    expect(tmAbility.can("create", "User")).toBe(false);
  });

  it("admin is the only one who can do everything", () => {
    const adminAbility = defineAbilitiesFor(makeUser("admin"));
    const gmAbility    = defineAbilitiesFor(makeUser("general_manager"));
    expect(adminAbility.can("manage", "all")).toBe(true);
    expect(gmAbility.can("manage", "all")).toBe(false);
  });
});
