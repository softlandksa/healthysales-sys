import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/types";
import type { UserRole } from "@/types";

const ROLE_VARIANT: Record<
  UserRole,
  "admin" | "general_manager" | "sales_manager" | "team_manager" | "sales_rep"
> = {
  admin: "admin",
  general_manager: "general_manager",
  sales_manager: "sales_manager",
  team_manager: "team_manager",
  sales_rep: "sales_rep",
};

interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <Badge variant={ROLE_VARIANT[role]}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "success" : "secondary"}>
      {isActive ? "نشط" : "غير نشط"}
    </Badge>
  );
}
