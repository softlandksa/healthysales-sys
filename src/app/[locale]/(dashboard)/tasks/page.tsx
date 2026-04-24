import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TasksTable } from "@/components/tasks/TasksTable";
import { listTasks } from "@/server/actions/tasks";
import { requireUser } from "@/lib/auth/current-user";
import type { TaskRow } from "@/types";

interface TasksPageProps {
  searchParams: Promise<{
    status?: string;
    assignedToId?: string;
    overdue?: string;
    page?: string;
  }>;
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const sp = await searchParams;
  const user    = await requireUser();
  const page    = Math.max(1, Number(sp.page ?? 1));
  const status  = sp.status ?? "";
  const assignedToId = sp.assignedToId ?? "";
  const overdue = sp.overdue === "1";

  const result = await listTasks({
    ...(status ? { status } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(overdue ? { overdue: true } : {}),
    page,
    pageSize: 20,
  }) as { tasks: TaskRow[]; total: number };

  const { tasks, total } = result;

  const isManager = user.role !== "sales_rep";
  const canCreate = !["sales_rep"].includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">المهام</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            إجمالي <span className="num">{total}</span> مهمة
          </p>
        </div>
        {canCreate && (
          <Link href="/ar/tasks/new">
            <Button>
              <Plus size={16} />
              مهمة جديدة
            </Button>
          </Link>
        )}
      </div>

      <Suspense>
        <TasksTable
          rows={tasks}
          total={total}
          page={page}
          pageSize={20}
          status={status}
          assignedToId={assignedToId}
          overdue={overdue}
          isManager={isManager}
        />
      </Suspense>
    </div>
  );
}
