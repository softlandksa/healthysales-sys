"use server";
import { withAuth } from "@/lib/rbac/access";
import { globalSearch } from "@/lib/search/global-search";
import type { SearchResults } from "@/lib/search/global-search";

export async function searchGlobal(query: string): Promise<SearchResults> {
  return withAuth("read", "Report", async (user) => {
    return globalSearch(query, user);
  });
}
