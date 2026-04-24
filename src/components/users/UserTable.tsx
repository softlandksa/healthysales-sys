"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { RoleBadge, StatusBadge } from "./RoleBadge";
import { deactivateUser, reactivateUser } from "@/server/actions/users";
import { UserCircle, Pencil, Search, Filter, Plus, UserX, UserCheck } from "lucide-react";
import type { UserRow, UserRole } from "@/types";
import { ROLE_LABELS } from "@/types";

interface UserTableProps {
  users: UserRow[];
  canCreate: boolean;
  canEdit: boolean;
}

export function UserTable({ users, canCreate, canEdit }: UserTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchActive =
      activeFilter === "all" ||
      (activeFilter === "active" ? u.isActive : !u.isActive);
    return matchSearch && matchRole && matchActive;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleToggleActive(user: UserRow) {
    startTransition(async () => {
      const result = user.isActive
        ? await deactivateUser(user.id)
        : await reactivateUser(user.id);

      if (result.success) {
        toast.success(user.isActive ? "تم تعطيل المستخدم" : "تم تفعيل المستخدم");
        router.refresh();
      } else {
        toast.error(result.error ?? "حدث خطأ");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <Input
              placeholder="بحث بالاسم أو البريد أو الهاتف…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pr-9"
            />
          </div>

          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as typeof roleFilter); setCurrentPage(1); }}>
            <SelectTrigger className="w-44">
              <Filter size={14} className="text-text-muted" />
              <SelectValue placeholder="الدور" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأدوار</SelectItem>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v as typeof activeFilter); setCurrentPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canCreate && (
          <Button asChild size="sm">
            <Link href="/ar/users/new">
              <Plus size={16} />
              إضافة مستخدم
            </Link>
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المستخدم</TableHead>
              <TableHead>الدور</TableHead>
              <TableHead className="hidden md:table-cell">الفريق</TableHead>
              <TableHead className="hidden lg:table-cell">المشرف</TableHead>
              <TableHead>الحالة</TableHead>
              {canEdit && <TableHead className="text-center">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="h-32 text-center text-text-muted">
                  <div className="flex flex-col items-center gap-2">
                    <UserCircle size={32} className="text-border-strong" />
                    <span>لا يوجد مستخدمون</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {user.name?.[0] ?? user.email[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-text-primary text-sm">{user.name ?? "—"}</p>
                        <p className="text-xs text-text-muted dir-ltr">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><RoleBadge role={user.role} /></TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-text-secondary">
                    {user.teamNameAr ?? <span className="text-text-muted">—</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-text-secondary">
                    {user.managerName ?? <span className="text-text-muted">—</span>}
                  </TableCell>
                  <TableCell><StatusBadge isActive={user.isActive} /></TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/ar/users/${user.id}/edit`} title="تعديل">
                            <Pencil size={15} />
                          </Link>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={user.isActive ? "hover:text-danger-600" : "hover:text-success-600"}
                              title={user.isActive ? "تعطيل" : "تفعيل"}
                              disabled={isPending}
                            >
                              {user.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {user.isActive ? "تعطيل المستخدم" : "تفعيل المستخدم"}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {user.isActive
                                  ? `هل تريد تعطيل حساب "${user.name ?? user.email}"؟ لن يتمكن من تسجيل الدخول.`
                                  : `هل تريد تفعيل حساب "${user.name ?? user.email}"؟`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleToggleActive(user)}
                                className={!user.isActive ? "bg-success-600 hover:bg-success-500" : ""}
                              >
                                {user.isActive ? "تعطيل" : "تفعيل"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span className="num">{filtered.length} نتيجة</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              السابق
            </Button>
            <span className="flex items-center px-3 num">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
