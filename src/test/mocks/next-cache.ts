import { vi } from "vitest";

export const revalidatePath  = vi.fn();
export const revalidateTag   = vi.fn();
export const unstable_cache  = vi.fn(<T>(fn: () => T) => fn);
export const cache           = vi.fn(<T>(fn: T) => fn);
