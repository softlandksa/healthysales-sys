"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createUser, updateUser, changePassword } from "@/server/actions/users";
import { ROLE_LABELS } from "@/types";
import type { UserRole, ActionResult } from "@/types";

interface UserOption { id: string; name: string | null; email: string; role: UserRole; }
interface TeamOption { id: string; nameAr: string; }

interface UserFormProps {
  mode: "create" | "edit";
  userId?: string;
  defaultValues?: {
    name?: string;
    email?: string;
    phone?: string;
    role?: UserRole;
    teamId?: string;
    managerId?: string;
    isActive?: boolean;
  };
  teams: TeamOption[];
  users: UserOption[];
  currentUserRole: UserRole;
}

const INITIAL: ActionResult = { success: false };

export function UserForm({ mode, userId, defaultValues, teams, users, currentUserRole }: UserFormProps) {
  const router = useRouter();

  // Build the correctly-typed action for useActionState
  const action =
    mode === "create"
      ? createUser
      : (prev: ActionResult, formData: FormData) =>
          updateUser(userId!, prev, formData);

  const [state, formAction, isPending] = useActionState(
    action as (prev: ActionResult, formData: FormData) => Promise<ActionResult>,
    INITIAL
  );

  useEffect(() => {
    if (state.success) {
      toast.success(mode === "create" ? "تم إنشاء المستخدم بنجاح" : "تم حفظ التغييرات");
      router.push("/ar/users");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, mode, router]);

  const isAdmin = currentUserRole === "admin";
  const availableRoles = (Object.keys(ROLE_LABELS) as UserRole[]).filter((r) => {
    if (isAdmin) return true;
    const hierarchy: Record<UserRole, number> = {
      admin: 5, general_manager: 4, sales_manager: 3, team_manager: 2, sales_rep: 1,
    };
    return (hierarchy[r] ?? 0) < (hierarchy[currentUserRole] ?? 0);
  });

  return (
    <form action={formAction} className="space-y-6">
      {/* Personal info */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-text-primary">البيانات الشخصية</h3>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" required>الاسم الكامل</Label>
            <Input id="name" name="name" defaultValue={defaultValues?.name ?? ""} placeholder="أحمد محمد العمري" required autoComplete="off" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" required>البريد الإلكتروني</Label>
            <Input id="email" name="email" type="email" dir="ltr" defaultValue={defaultValues?.email ?? ""} placeholder="user@example.com" required disabled={mode === "edit"} autoComplete="off" />
            {mode === "edit" && <p className="text-xs text-text-muted">لا يمكن تغيير البريد الإلكتروني</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={defaultValues?.phone ?? ""} placeholder="05xxxxxxxx" autoComplete="off" />
          </div>

          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="password" required>كلمة المرور</Label>
              <Input id="password" name="password" type="password" placeholder="6 أحرف على الأقل" required autoComplete="new-password" />
            </div>
          )}
        </div>
      </div>

      {/* Role & Team */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-text-primary">الدور والفريق</h3>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="role" required>الدور الوظيفي</Label>
            <Select name="role" defaultValue={defaultValues?.role ?? "sales_rep"}>
              <SelectTrigger id="role"><SelectValue placeholder="اختر الدور" /></SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="teamId">الفريق</Label>
            <Select name="teamId" defaultValue={defaultValues?.teamId ?? "none"}>
              <SelectTrigger id="teamId"><SelectValue placeholder="اختر فريقاً (اختياري)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون فريق</SelectItem>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.nameAr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="managerId">المشرف المباشر</Label>
            <Select name="managerId" defaultValue={defaultValues?.managerId ?? "none"}>
              <SelectTrigger id="managerId"><SelectValue placeholder="اختر المشرف (اختياري)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون مشرف</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email} — {ROLE_LABELS[u.role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === "edit" && (
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium text-text-primary">الحساب نشط</p>
              <p className="text-xs text-text-muted">تعطيل الحساب يمنع تسجيل الدخول</p>
            </div>
            <Switch
              name="isActive"
              defaultChecked={defaultValues?.isActive ?? true}
              onCheckedChange={(checked) => {
                const input = document.querySelector<HTMLInputElement>('input[name="isActive"]');
                if (input) input.value = checked.toString();
              }}
            />
            <input type="hidden" name="isActive" defaultValue={String(defaultValues?.isActive ?? true)} />
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/ar/users")} disabled={isPending}>إلغاء</Button>
        <Button type="submit" loading={isPending}>
          {mode === "create" ? "إنشاء المستخدم" : "حفظ التغييرات"}
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordForm({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(changePassword, INITIAL);

  useEffect(() => {
    if (state.success) toast.success("تم تغيير كلمة المرور");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="card p-6 space-y-4">
      <h3 className="font-semibold text-text-primary">إعادة تعيين كلمة المرور</h3>
      <Separator />
      <input type="hidden" name="userId" value={userId} />
      <div className="space-y-1.5 max-w-sm">
        <Label htmlFor="newPassword" required>كلمة المرور الجديدة</Label>
        <Input id="newPassword" name="newPassword" type="password" placeholder="6 أحرف على الأقل" autoComplete="new-password" required />
      </div>
      <Button type="submit" variant="outline" loading={isPending} size="sm">تعيين كلمة المرور</Button>
    </form>
  );
}
