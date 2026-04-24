import { vi } from "vitest";

export const redirect         = vi.fn();
export const notFound         = vi.fn();
export const useRouter        = vi.fn(() => ({ push: vi.fn(), replace: vi.fn() }));
export const usePathname      = vi.fn(() => "/");
export const useSearchParams  = vi.fn(() => new URLSearchParams());
