import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTaskDetail } from "@/server/actions/tasks";
import { requireUser } from "@/lib/auth/current-user";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import type { TaskStatus } from "@/types";

interface TaskPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { id }   = await params;
  const user     = await requireUser();

  const result = await getTaskDetail(id);

  if (!result || (result as { error?: string }).error) {
    notFound();
  }

  // getTaskDetail returns the prisma object directly (no ActionResult wrapper)
  const task = result as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    dueDate: Date;
    completedAt: Date | null;
    assignedTo: { id: string; name: string | null; email: string; role: string };
    assignedBy: { id: string; name: string | null; email: string };
    comments: Array<{
      id: string;
      body: string;
      createdAt: Date;
      user: { id: string; name: string | null; role: string };
    }>;
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/ar/tasks" className="hover:text-brand-700 transition-colors">المهام</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-text-primary font-medium line-clamp-1">{task.title}</span>
      </nav>

      <TaskDetail
        task={{ ...task, status: task.status as TaskStatus }}
        currentUser={user}
      />
    </div>
  );
}
