import { AsyncLocalStorage } from "async_hooks";

export interface AuditContext {
  userId:    string;
  ip:        string | null;
  userAgent: string | null;
  requestId: string;
}

const store = new AsyncLocalStorage<AuditContext>();

export function runWithAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return store.run(ctx, fn);
}

export function getAuditContext(): AuditContext | undefined {
  return store.getStore();
}
