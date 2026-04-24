import { vi } from "vitest";

export default vi.fn(() => ({
  handlers: {},
  auth:     vi.fn(async () => null),
  signIn:   vi.fn(),
  signOut:  vi.fn(),
}));

export const auth = vi.fn(async () => null);
