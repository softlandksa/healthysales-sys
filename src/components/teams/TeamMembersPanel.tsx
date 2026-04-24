"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RoleBadge, StatusBadge } from "@/components/users/RoleBadge";
import { addTeamMember, removeTeamMember } from "@/server/actions/teams";
import { UserPlus, UserMinus, Users } from "lucide-react";
import type { UserRole } from "@/types";

interface Member {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
}

interface NonMember { id: string; name: string | null; email: string; }

interface TeamMembersPanelProps {
  teamId: string;
  members: Member[];
  nonMembers: NonMember[];
  canManage: boolean;
}

export function TeamMembersPanel({ teamId, members, nonMembers, canManage }: TeamMembersPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  function handleAdd() {
    if (!selectedUserId) return;
    startTransition(async () => {
      const result = await addTeamMember(teamId, selectedUserId);
      if (result.success) {
        toast.success("تمت إضافة العضو");
        setAddOpen(false);
        setSelectedUserId("");
        router.refresh();
      } else {
        toast.error(result.error ?? "تعذر إضافة العضو");
      }
    });
  }

  function handleRemove(userId: string, userName: string) {
    startTransition(async () => {
      const result = await removeTeamMember(teamId, userId);
      if (result.success) {
        toast.success(`تمت إزالة "${userName}" من الفريق`);
        router.refresh();
      } else {
        toast.error(result.error ?? "تعذر إزالة العضو");
      }
    });
  }

  return (
    <div className="space-y-4">
      {canManage && nonMembers.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus size={15} />
            إضافة عضو
          </Button>
        </div>
      )}

      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العضو</TableHead>
              <TableHead>الدور</TableHead>
              <TableHead className="hidden md:table-cell">الهاتف</TableHead>
              <TableHead>الحالة</TableHead>
              {canManage && <TableHead className="text-center">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4} className="h-28 text-center text-text-muted">
                  <div className="flex flex-col items-center gap-2">
                    <Users size={28} className="text-border-strong" />
                    <span>لا يوجد أعضاء في هذا الفريق</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {m.name?.[0] ?? m.email[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{m.name ?? "—"}</p>
                        <p className="text-xs text-text-muted">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><RoleBadge role={m.role} /></TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-text-secondary num">
                    {m.phone ?? "—"}
                  </TableCell>
                  <TableCell><StatusBadge isActive={m.isActive} /></TableCell>
                  {canManage && (
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-danger-600"
                        onClick={() => handleRemove(m.id, m.name ?? m.email)}
                        disabled={isPending}
                        title="إزالة من الفريق"
                      >
                        <UserMinus size={15} />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add member dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة عضو للفريق</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر مستخدماً…" />
              </SelectTrigger>
              <SelectContent>
                {nonMembers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={handleAdd} loading={isPending} disabled={!selectedUserId}>
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
