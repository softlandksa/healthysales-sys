"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { deleteTeam } from "@/server/actions/teams";
import { Users, Plus, Trash2, Eye } from "lucide-react";
import type { TeamRow } from "@/types";

interface TeamTableProps {
  teams: TeamRow[];
  canCreate: boolean;
  canDelete: boolean;
}

export function TeamTable({ teams, canCreate, canDelete }: TeamTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(teamId: string, teamName: string) {
    startTransition(async () => {
      const result = await deleteTeam(teamId);
      if (result.success) {
        toast.success(`تم حذف فريق "${teamName}"`);
        router.refresh();
      } else {
        toast.error(result.error ?? "تعذر حذف الفريق");
      }
    });
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button asChild size="sm">
            <Link href="/ar/teams/new">
              <Plus size={16} />
              إضافة فريق
            </Link>
          </Button>
        </div>
      )}

      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>اسم الفريق</TableHead>
              <TableHead>مدير الفريق</TableHead>
              <TableHead className="text-center">الأعضاء</TableHead>
              <TableHead className="hidden md:table-cell">تاريخ الإنشاء</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-text-muted">
                  <div className="flex flex-col items-center gap-2">
                    <Users size={32} className="text-border-strong" />
                    <span>لا توجد فرق</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>
                    <p className="font-medium text-text-primary">{team.nameAr}</p>
                    {team.nameEn && <p className="text-xs text-text-muted">{team.nameEn}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
                    {team.managerName ?? <span className="text-text-muted">غير محدد</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="num inline-flex items-center gap-1 text-sm font-medium">
                      <Users size={14} className="text-text-muted" />
                      {team.memberCount}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-text-muted num">
                    {new Date(team.createdAt).toLocaleDateString("ar-SA")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" asChild title="عرض التفاصيل">
                        <Link href={`/ar/teams/${team.id}`}>
                          <Eye size={15} />
                        </Link>
                      </Button>

                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:text-danger-600"
                              title="حذف"
                              disabled={isPending || team.memberCount > 0}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الفريق</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من حذف فريق &quot;{team.nameAr}&quot;؟ لا يمكن التراجع عن هذا الإجراء.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(team.id, team.nameAr)}>
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
