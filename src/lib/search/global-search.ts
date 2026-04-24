import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import type { SessionUser } from "@/types";

export type SearchResultType =
  | "customer"
  | "user"
  | "product"
  | "sales_order"
  | "collection"
  | "visit"
  | "competition"
  | "task";

export interface SearchResultItem {
  id:        string;
  type:      SearchResultType;
  title:     string;
  subtitle?: string;
  href:      string;
}

export interface SearchResults {
  customers:    SearchResultItem[];
  users:        SearchResultItem[];
  products:     SearchResultItem[];
  salesOrders:  SearchResultItem[];
  collections:  SearchResultItem[];
  visits:       SearchResultItem[];
  competitions: SearchResultItem[];
  tasks:        SearchResultItem[];
}

const LIMIT = 5;

function ilike(q: string) {
  return { contains: q, mode: "insensitive" as const };
}

export async function globalSearch(
  query: string,
  user: SessionUser
): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) {
    return { customers: [], users: [], products: [], salesOrders: [], collections: [], visits: [], competitions: [], tasks: [] };
  }

  const accessibleIds = await getAccessibleUserIds(user);

  const [customers, users, products, salesOrders, collections, visits, competitions, tasks] = await Promise.all([
    // Customers — scoped to reps the user can see
    prisma.customer.findMany({
      where: {
        AND: [
          { assignedToId: { in: accessibleIds } },
          { OR: [{ nameAr: ilike(q) }, { nameEn: ilike(q) }, { code: ilike(q) }, { phone: ilike(q) }] },
        ],
      },
      select: { id: true, nameAr: true, code: true },
      take: LIMIT,
    }),

    // Users — sales_rep sees no user results
    user.role === "sales_rep"
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: {
            AND: [
              { id: { in: accessibleIds } },
              { OR: [{ name: ilike(q) }, { email: ilike(q) }] },
            ],
          },
          select: { id: true, name: true, email: true, role: true },
          take: LIMIT,
        }),

    // Products — no RBAC filter
    prisma.product.findMany({
      where: {
        OR: [{ nameAr: ilike(q) }, { nameEn: ilike(q) }, { code: ilike(q) }],
      },
      select: { id: true, nameAr: true, code: true },
      take: LIMIT,
    }),

    // Sales orders — scoped via repId
    prisma.salesOrder.findMany({
      where: {
        AND: [
          { repId: { in: accessibleIds } },
          { OR: [{ id: ilike(q) }, { customer: { OR: [{ nameAr: ilike(q) }, { code: ilike(q) }] } }] },
        ],
      },
      select: { id: true, customer: { select: { nameAr: true } }, status: true, createdAt: true },
      take: LIMIT,
    }),

    // Collections
    prisma.collection.findMany({
      where: {
        AND: [
          { repId: { in: accessibleIds } },
          { customer: { OR: [{ nameAr: ilike(q) }, { code: ilike(q) }] } },
        ],
      },
      select: { id: true, customer: { select: { nameAr: true } }, amount: true, collectedAt: true },
      take: LIMIT,
    }),

    // Visits — visitType not type
    prisma.visit.findMany({
      where: {
        AND: [
          { repId: { in: accessibleIds } },
          { customer: { OR: [{ nameAr: ilike(q) }, { code: ilike(q) }] } },
        ],
      },
      select: { id: true, customer: { select: { nameAr: true } }, visitedAt: true, visitType: true },
      take: LIMIT,
    }),

    // Competitions — field is `name`, not `nameAr`/`nameEn`
    prisma.competition.findMany({
      where: { name: ilike(q) },
      select: { id: true, name: true, status: true },
      take: LIMIT,
    }),

    // Tasks — assignedToId and assignedById
    prisma.task.findMany({
      where: {
        AND: [
          { OR: [{ assignedToId: { in: accessibleIds } }, { assignedById: { in: accessibleIds } }] },
          { OR: [{ title: ilike(q) }, { description: ilike(q) }] },
        ],
      },
      select: { id: true, title: true, status: true },
      take: LIMIT,
    }),
  ]);

  return {
    customers: customers.map((c) => ({
      id: c.id, type: "customer", title: c.nameAr, subtitle: c.code, href: `/ar/customers/${c.id}`,
    })),
    users: (users as { id: string; name: string | null; email: string; role: string }[]).map((u) => ({
      id: u.id, type: "user", title: u.name ?? u.email, subtitle: u.email, href: `/ar/users/${u.id}`,
    })),
    products: products.map((p) => ({
      id: p.id, type: "product", title: p.nameAr, subtitle: p.code, href: `/ar/products/${p.id}`,
    })),
    salesOrders: salesOrders.map((o) => ({
      id: o.id, type: "sales_order", title: o.customer?.nameAr ?? o.id, subtitle: `طلب ${o.id.slice(-6)}`, href: `/ar/sales/${o.id}`,
    })),
    collections: collections.map((c) => ({
      id: c.id, type: "collection", title: c.customer?.nameAr ?? c.id,
      subtitle: `تحصيل ${Number(c.amount).toLocaleString("ar-SA")} ر.س`, href: `/ar/collections/${c.id}`,
    })),
    visits: visits.map((v) => ({
      id: v.id, type: "visit", title: v.customer?.nameAr ?? v.id,
      subtitle: new Date(v.visitedAt).toLocaleDateString("ar-SA"), href: `/ar/visits/${v.id}`,
    })),
    competitions: competitions.map((c) => ({
      id: c.id, type: "competition", title: c.name, subtitle: c.status, href: `/ar/competitions/${c.id}`,
    })),
    tasks: tasks.map((t) => ({
      id: t.id, type: "task", title: t.title, subtitle: t.status, href: `/ar/tasks/${t.id}`,
    })),
  };
}
