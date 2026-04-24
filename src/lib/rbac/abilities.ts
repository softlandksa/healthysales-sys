import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from "@casl/ability";
import type { SessionUser, UserRole } from "@/types";

export type Actions = "create" | "read" | "update" | "delete" | "manage";

export type Subjects =
  | "User"
  | "Team"
  | "Customer"
  | "Product"
  | "Visit"
  | "SalesOrder"
  | "Collection"
  | "Task"
  | "Competition"
  | "Target"
  | "Report"
  | "AuditLog"
  | "all";

export type AppAbility = MongoAbility<[Actions, Subjects]>;

// Subject display names for error messages
export const SUBJECT_LABELS: Record<Subjects, string> = {
  User: "المستخدم",
  Team: "الفريق",
  Customer: "العميل",
  Product: "المنتج",
  Visit: "الزيارة",
  SalesOrder: "الطلب",
  Collection: "التحصيل",
  Task: "المهمة",
  Competition: "المنافسة",
  Target: "الهدف",
  Report: "التقرير",
  AuditLog: "سجل التدقيق",
  all: "كل شيء",
};

export function defineAbilitiesFor(user: SessionUser): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const role: UserRole = user.role;

  switch (role) {
    case "admin":
      can("manage", "all");
      break;

    case "general_manager":
      // Users — read/update within hierarchy (row-level enforced via getAccessibleUserIds)
      can(["read", "update", "create"], "User");
      // Teams — full management
      can("manage", "Team");
      // Read everything in their org
      can("read", [
        "Customer",
        "Product",
        "Visit",
        "SalesOrder",
        "Collection",
        "Task",
        "Target",
        "Report",
        "AuditLog",
      ]);
      // Manage competitions and targets
      can("manage", ["Competition", "Target"]);
      break;

    case "sales_manager":
      // Users — manage team_managers and sales_reps in their subtree
      can(["read", "create", "update", "delete"], "User");
      // Teams — manage teams in their area
      can("manage", "Team");
      // Operations — full management for their area
      can("manage", ["Customer", "Visit", "SalesOrder", "Collection", "Task", "Competition", "Target"]);
      // Analytics — read only
      can("read", ["Report", "Product"]);
      break;

    case "team_manager":
      // Users — read own team members only (row-level enforced)
      can("read", "User");
      can("update", "User"); // update profile of own members
      // Own team info
      can("read", "Team");
      // Operations — manage for their team
      can("manage", ["Customer", "Visit", "SalesOrder", "Collection", "Task", "Target"]);
      // Analytics — read own team data
      can("read", ["Report", "Product", "Competition"]);
      break;

    case "sales_rep":
      // Own profile
      can("read", "User");
      // Own operations
      can("manage", "Visit");
      // Tasks: read own + update status — no create/delete
      can(["read", "update"], "Task");
      can(["create", "read", "update"], "SalesOrder");
      can("create", "Collection");
      can("read", ["Customer", "Product", "Target", "Competition", "Report"]);
      break;
  }

  return build();
}
