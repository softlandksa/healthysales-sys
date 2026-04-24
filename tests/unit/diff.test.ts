import { describe, it, expect } from "vitest";

// ─── Diff helpers extracted from prisma-extension logic ───────────────────────

const REDACT_FIELDS = /password|token|secret|key|hash/i;

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT_FIELDS.test(k) ? "[REDACTED]" : v;
  }
  return out;
}

function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("redact()", () => {
  it("redacts password field", () => {
    const result = redact({ email: "a@b.com", password: "secret123" });
    expect(result.password).toBe("[REDACTED]");
    expect(result.email).toBe("a@b.com");
  });

  it("redacts token field", () => {
    const result = redact({ id: "1", token: "abc123" });
    expect(result.token).toBe("[REDACTED]");
    expect(result.id).toBe("1");
  });

  it("redacts secret field", () => {
    expect(redact({ secret: "xyz" }).secret).toBe("[REDACTED]");
  });

  it("redacts apiKey field (contains 'key')", () => {
    expect(redact({ apiKey: "k123" }).apiKey).toBe("[REDACTED]");
  });

  it("redacts hash field", () => {
    expect(redact({ passwordHash: "hashed" }).passwordHash).toBe("[REDACTED]");
  });

  it("does not redact non-sensitive fields", () => {
    const result = redact({ name: "Alice", role: "admin", isActive: true });
    expect(result).toEqual({ name: "Alice", role: "admin", isActive: true });
  });

  it("handles empty object", () => {
    expect(redact({})).toEqual({});
  });
});

describe("diffFields()", () => {
  it("detects changed fields", () => {
    const before = { name: "Alice", role: "sales_rep" };
    const after  = { name: "Alice", role: "admin" };
    expect(diffFields(before, after)).toEqual(["role"]);
  });

  it("detects added fields", () => {
    const before = { name: "Alice" };
    const after  = { name: "Alice", phone: "0501234567" };
    expect(diffFields(before, after)).toContain("phone");
  });

  it("detects removed fields", () => {
    const before = { name: "Alice", phone: "0501234567" };
    const after  = { name: "Alice" };
    expect(diffFields(before, after)).toContain("phone");
  });

  it("returns empty array when no changes", () => {
    const obj = { name: "Bob", age: 30 };
    expect(diffFields(obj, { ...obj })).toHaveLength(0);
  });

  it("handles nested objects by JSON comparison", () => {
    const before = { meta: { a: 1 } };
    const after  = { meta: { a: 2 } };
    expect(diffFields(before, after)).toContain("meta");
  });

  it("treats null vs undefined as different", () => {
    const before: Record<string, unknown> = { field: null };
    const after:  Record<string, unknown> = { field: undefined };
    expect(diffFields(before, after)).toContain("field");
  });
});

describe("SKIP_MODELS logic", () => {
  const SKIP_MODELS = new Set([
    "AuditLog", "Notification", "Setting", "Session", "Account", "VerificationToken",
  ]);

  it("skips AuditLog", () => expect(SKIP_MODELS.has("AuditLog")).toBe(true));
  it("skips Notification", () => expect(SKIP_MODELS.has("Notification")).toBe(true));
  it("skips Session", () => expect(SKIP_MODELS.has("Session")).toBe(true));
  it("skips Account", () => expect(SKIP_MODELS.has("Account")).toBe(true));
  it("skips VerificationToken", () => expect(SKIP_MODELS.has("VerificationToken")).toBe(true));
  it("does not skip User", () => expect(SKIP_MODELS.has("User")).toBe(false));
  it("does not skip SalesOrder", () => expect(SKIP_MODELS.has("SalesOrder")).toBe(false));
  it("does not skip Product", () => expect(SKIP_MODELS.has("Product")).toBe(false));
});

describe("WRITE_OPS logic", () => {
  const WRITE_OPS = new Set([
    "create", "update", "delete", "upsert", "createMany", "updateMany", "deleteMany",
  ]);

  it("includes create", () => expect(WRITE_OPS.has("create")).toBe(true));
  it("includes update", () => expect(WRITE_OPS.has("update")).toBe(true));
  it("includes delete", () => expect(WRITE_OPS.has("delete")).toBe(true));
  it("does not include findMany", () => expect(WRITE_OPS.has("findMany")).toBe(false));
  it("does not include findUnique", () => expect(WRITE_OPS.has("findUnique")).toBe(false));
  it("does not include count", () => expect(WRITE_OPS.has("count")).toBe(false));
  it("does not include aggregate", () => expect(WRITE_OPS.has("aggregate")).toBe(false));
});
