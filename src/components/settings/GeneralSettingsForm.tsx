"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { saveSystemSettings } from "@/server/actions/settings";
import type { SystemSettings } from "@/server/actions/settings";
import type { ActionResult } from "@/types";

const INITIAL: ActionResult = { success: false };

interface Props {
  settings: SystemSettings;
  isAdmin: boolean;
}

export function GeneralSettingsForm({ settings, isAdmin }: Props) {
  const [state, formAction, isPending] = useActionState(saveSystemSettings, INITIAL);

  useEffect(() => {
    if (state.success) toast.success("تم حفظ الإعدادات");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-text-primary">بيانات الشركة</h3>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="company_name" required>اسم الشركة / النظام</Label>
            <Input
              id="company_name"
              name="company_name"
              defaultValue={settings.company_name}
              placeholder="نظام المبيعات الميداني"
              disabled={!isAdmin}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_phone">هاتف التواصل</Label>
            <Input
              id="company_phone"
              name="company_phone"
              type="tel"
              dir="ltr"
              defaultValue={settings.company_phone}
              placeholder="05xxxxxxxxx"
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_email">البريد الإلكتروني</Label>
            <Input
              id="company_email"
              name="company_email"
              type="email"
              dir="ltr"
              defaultValue={settings.company_email}
              placeholder="info@company.com"
              disabled={!isAdmin}
            />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-text-primary">إعدادات المالية</h3>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="currency_label" required>رمز العملة</Label>
            <Input
              id="currency_label"
              name="currency_label"
              defaultValue={settings.currency_label}
              placeholder="ر.س"
              disabled={!isAdmin}
              maxLength={10}
            />
            <p className="text-xs text-text-muted">مثال: ر.س أو SAR</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max_discount_pct" required>الحد الأقصى للخصم (%)</Label>
            <Input
              id="max_discount_pct"
              name="max_discount_pct"
              type="number"
              min={0}
              max={100}
              defaultValue={settings.max_discount_pct}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fiscal_year_start" required>بداية السنة المالية</Label>
            <Input
              id="fiscal_year_start"
              name="fiscal_year_start"
              defaultValue={settings.fiscal_year_start}
              placeholder="01-01"
              disabled={!isAdmin}
            />
            <p className="text-xs text-text-muted">صيغة: يوم-شهر (مثال: 01-01)</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button type="submit" loading={isPending}>حفظ الإعدادات</Button>
        </div>
      )}
      {!isAdmin && (
        <p className="text-sm text-text-muted text-center">
          هذه الإعدادات للعرض فقط — يلزم دور المسؤول لتعديلها
        </p>
      )}
    </form>
  );
}
