import { PrismaClient, Prisma } from "@prisma/client";
import { getAuditContext } from "./request-context";

const SKIP_MODELS = new Set([
  "AuditLog",
  "Notification",
  "Setting",
  "Session",
  "Account",
  "VerificationToken",
]);

const WRITE_OPS = new Set(["create", "update", "delete", "upsert", "createMany", "updateMany", "deleteMany"]);

const REDACT_FIELDS = /password|token|secret|key|hash/i;

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT_FIELDS.test(k) ? "[REDACTED]" : v;
  }
  return out;
}

function toPlain(v: unknown): Record<string, unknown> | null {
  if (v == null || typeof v !== "object") return null;
  return redact(v as Record<string, unknown>);
}

// Map Prisma model name → table accessor on the base client
const MODEL_MAP: Record<string, keyof PrismaClient> = {
  User:                "user",
  Team:                "team",
  Product:             "product",
  Customer:            "customer",
  CustomerTransaction: "customerTransaction",
  Visit:               "visit",
  SalesOrder:          "salesOrder",
  SalesOrderItem:      "salesOrderItem",
  Collection:          "collection",
  Task:                "task",
  TaskComment:         "taskComment",
  Competition:         "competition",
  CompetitionResult:   "competitionResult",
  Target:              "target",
};

export const auditExtension = Prisma.defineExtension((client) => {
  // `client` is the base PrismaClient (before this extension).
  // Using it here avoids a circular import (prisma.ts → extension → prisma.ts).
  // Reads are never intercepted (WRITE_OPS check), and AuditLog is in SKIP_MODELS,
  // so these calls cannot recurse.
  const base = client as unknown as PrismaClient;

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!WRITE_OPS.has(operation) || !model || SKIP_MODELS.has(model)) {
            return query(args);
          }

          const ctx = getAuditContext();

          let before: Record<string, unknown> | null = null;
          if (ctx && (operation === "update" || operation === "delete" || operation === "upsert")) {
            try {
              const accessor = MODEL_MAP[model];
              if (accessor) {
                const delegate = (base as unknown as Record<string, { findUnique?: (a: unknown) => Promise<unknown> }>)[accessor as string];
                const typedArgs = args as { where?: unknown };
                if (delegate?.findUnique && typedArgs.where) {
                  before = toPlain(await delegate.findUnique({ where: typedArgs.where }));
                }
              }
            } catch {
              // best-effort; don't block mutation
            }
          }

          const result = await query(args);

          if (ctx) {
            setImmediate(async () => {
              try {
                const after = toPlain(result as Record<string, unknown>);
                const entityId =
                  (result as Record<string, unknown>)?.id as string | undefined;

                await base.auditLog.create({
                  data: {
                    action:     operation,
                    entityType: model,
                    ...(entityId ? { entityId } : {}),
                    metadata: { before, after } as unknown as Prisma.InputJsonValue,
                    ...(ctx.ip ? { ipAddress: ctx.ip } : {}),
                    userId: ctx.userId,
                  },
                });
              } catch {
                // silent — never crash the request
              }
            });
          }

          return result;
        },
      },
    },
  });
});
