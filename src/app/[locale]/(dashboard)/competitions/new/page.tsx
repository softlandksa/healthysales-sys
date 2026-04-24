import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { CompetitionForm } from "@/components/competitions/CompetitionForm";

export default async function NewCompetitionPage() {
  const user = await requireUser();

  if (!["admin", "general_manager", "sales_manager"].includes(user.role)) {
    redirect("/ar/competitions");
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">مسابقة جديدة</h1>
        <p className="text-sm text-text-secondary mt-0.5">إنشاء مسابقة مبيعات لتحفيز الفريق</p>
      </div>
      <div className="card p-5">
        <CompetitionForm />
      </div>
    </div>
  );
}
