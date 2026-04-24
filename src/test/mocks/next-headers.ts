import { vi } from "vitest";

export const headers = vi.fn(async () => ({
  get: vi.fn((_key: string) => null),
}));

export const cookies = vi.fn(async () => ({
  get: vi.fn((_key: string) => undefined),
}));
