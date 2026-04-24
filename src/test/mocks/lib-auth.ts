import { vi } from "vitest";

export const handlers = {};
export const auth     = vi.fn(async () => null);
export const signIn   = vi.fn();
export const signOut  = vi.fn();
