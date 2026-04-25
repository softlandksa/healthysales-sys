"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { updateProfile, changeOwnPassword } from "@/server/actions/settings";
import type { ActionResult } from "@/types";

interface Props {
  name: string;
  email: string;
  phone: string;
}

const INITIAL: ActionResult = { success: false };

export function AccountTab({ name, email, phone }: Props) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, INITIAL);
  const [pwState, pwAction, pwPending] = useActionState(changeOwnPassword, INITIAL);

  useEffect(() => {
    if (profileState.success) toast.success("تم تحديث الملف الشخصي");
    else if (profileState.error) toast.error(profileState.error);
  }, [profileState]);

  useEffect(() => {
    if (pwState.success) toast.success("تم تغيير كلمة المرور بنجاح");
    else if (pwState.error) toast.error(pwState.error);
  }, [pwState]);

  return (
    <div className="space-y-6">
      {/* Profile */}
      <form action={profileAction} className="card p-6 space-y-4">
        <h3 className="font-semibold text-text-primary">الملف الشخصي</h3>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" required>الاسم الكامل</Label>
            <Input id="name" name="name" defaultValue={name} placeholder="الاسم الكامل" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" name="email" type="email" dir="ltr" value={email} disabled readOnly />
            <p className="text-xs text-text-muted">لا يمكن تغيير البريد الإلكتروني</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              dir="ltr"
              defaultValue={phone}
              placeholder="05xxxxxxxxx"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={profilePending}>حفظ الملف الشخصي</Button>
        </div>
      </form>

      {/* Change password */}
      <form action={pwAction} className="card p-6 space-y-4">
        <h3 className="font-semibold text-text-primary">تغيير كلمة المرور</h3>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword" required>كلمة المرور الحالية</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword" required>كلمة المرور الجديدة</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="6 أحرف على الأقل"
              autoComplete="new-password"
              required
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="outline" loading={pwPending}>تغيير كلمة المرور</Button>
        </div>
      </form>
    </div>
  );
}
