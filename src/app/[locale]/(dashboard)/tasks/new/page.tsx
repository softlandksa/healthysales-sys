import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { TaskForm } from "@/components/tasks/TaskForm";
import type { ComboboxOption } from "@/components/ui/combobox";

export default async function NewTaskPage() {
  const user = await requireUser();

  if (user.role === "sales_rep") {
    redirect("/ar/tasks");
  }

  const accessibleIds = await getAccessibleUserIds(user);

  // Exclude self (managers cannot self-assign) unless admin
  const candidateIds = user.role === "admin"
    ? accessibleIds
    : accessibleIds.filter((id) => id !== user.id);

  const users = await prisma.user.findMany({
    where: { id: { in: candidateIds }, isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  const userOptions: ComboboxOption[] = users.map((u) => ({
    value: u.id,
    label: u.name ?? u.email,
    sublabel: u.email,
  }));

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">مهمة جديدة</h1>
        <p className="text-sm text-text-secondary mt-0.5">إسناد مهمة لأحد أعضاء الفريق</p>
      </div>
      <div className="card p-5">
        <TaskForm userOptions={userOptions} />
      </div>
    </div>
  );
}
