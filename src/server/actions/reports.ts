"use server";

import { withAuth, getAccessibleUserIds } from "@/lib/rbac/access";
import { ForbiddenError } from "@/lib/errors";
import { buildRepReport }           from "@/lib/reports/builders/rep-report";
import { buildTeamReport }          from "@/lib/reports/builders/team-report";
import { buildCustomersReport }     from "@/lib/reports/builders/customers-report";
import { buildExpiryReport }        from "@/lib/reports/builders/expiry-report";
import { buildCollectionsReport }   from "@/lib/reports/builders/collections-report";
import { buildCompetitionsReport }  from "@/lib/reports/builders/competitions-report";
import { buildActivityHeatmap }     from "@/lib/reports/builders/activity-heatmap";
import type {
  RepReportFilters,    RepReportData,
  TeamReportFilters,   TeamReportData,
  CustomersReportFilters, CustomersReportData,
  ExpiryReportFilters, ExpiryReportData,
  CollectionsReportFilters, CollectionsReportData,
  CompetitionsReportFilters, CompetitionsReportData,
  ActivityHeatmapFilters, ActivityHeatmapData,
} from "@/lib/reports/types";

// ─── Individual rep report ────────────────────────────────────────────────────

export async function getRepReport(filters: RepReportFilters): Promise<RepReportData> {
  return withAuth("read", "Report", async (user) => {
    const accessible = await getAccessibleUserIds(user);
    // Sales reps can only view their own data
    if (user.role === "sales_rep" && filters.repId !== user.id) {
      throw new ForbiddenError();
    }
    return buildRepReport(filters, accessible);
  });
}

// ─── Team report ──────────────────────────────────────────────────────────────

export async function getTeamReport(filters: TeamReportFilters): Promise<TeamReportData> {
  return withAuth("read", "Report", async (user) => {
    if (user.role === "sales_rep") throw new ForbiddenError();
    const accessible = await getAccessibleUserIds(user);
    return buildTeamReport(filters, accessible);
  });
}

// ─── Customers report ─────────────────────────────────────────────────────────

export async function getCustomersReport(filters: CustomersReportFilters): Promise<CustomersReportData> {
  return withAuth("read", "Report", async (user) => {
    const accessible = await getAccessibleUserIds(user);
    // Reps scoped to themselves
    const scopedFilters: CustomersReportFilters = {
      ...filters,
      ...(user.role === "sales_rep" ? { repId: user.id } : {}),
    };
    return buildCustomersReport(scopedFilters, accessible);
  });
}

// ─── Expiry report ────────────────────────────────────────────────────────────

export async function getExpiryReport(filters: ExpiryReportFilters): Promise<ExpiryReportData> {
  return withAuth("read", "Report", async (user) => {
    const accessible = await getAccessibleUserIds(user);
    const scopedFilters: ExpiryReportFilters = {
      ...filters,
      ...(user.role === "sales_rep" ? { repId: user.id } : {}),
    };
    return buildExpiryReport(scopedFilters, accessible);
  });
}

// ─── Collections report ───────────────────────────────────────────────────────

export async function getCollectionsReport(filters: CollectionsReportFilters): Promise<CollectionsReportData> {
  return withAuth("read", "Report", async (user) => {
    const accessible = await getAccessibleUserIds(user);
    const scopedFilters: CollectionsReportFilters = {
      ...filters,
      ...(user.role === "sales_rep" ? { repId: user.id } : {}),
    };
    return buildCollectionsReport(scopedFilters, accessible);
  });
}

// ─── Competitions report ──────────────────────────────────────────────────────

export async function getCompetitionsReport(filters: CompetitionsReportFilters): Promise<CompetitionsReportData> {
  return withAuth("read", "Report", async () => {
    return buildCompetitionsReport(filters);
  });
}

// ─── Activity heatmap ─────────────────────────────────────────────────────────

export async function getActivityHeatmap(filters: ActivityHeatmapFilters): Promise<ActivityHeatmapData> {
  return withAuth("read", "Report", async (user) => {
    const accessible = await getAccessibleUserIds(user);
    const scopedFilters: ActivityHeatmapFilters = {
      ...filters,
      ...(user.role === "sales_rep" ? { repId: user.id } : {}),
    };
    return buildActivityHeatmap(scopedFilters, accessible);
  });
}
