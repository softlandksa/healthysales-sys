import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { TargetForm } from "@/components/targets/TargetForm";

export const metadata: Metadata = {
  title: "هدف جديد",
};

export default async function NewTargetPage() {
  const user = await requireUser();

  if (!["admin", "general_manager", "sales_manager", "team_manager"].includes(user.role)) {
    redirect("/ar/targets");
  }

  const accessibleIds = await getAccessibleUserIds(user);
  const reps = await prisma.user.findMany({
    where: { id: { in: accessibleIds }, role: "sales_rep", isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-lg space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/ar/targets" className="hover:text-brand-700 transition-colors">الأهداف</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-text-primary font-medium">هدف جديد</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">هدف جديد</h1>
        <p className="text-sm text-text-secondary mt-1">تعيين هدف لمندوب خلال فترة محددة</p>
      </div>

      <div className="card p-6">
        <TargetForm reps={reps} />
      </div>
    </div>
  );
}
