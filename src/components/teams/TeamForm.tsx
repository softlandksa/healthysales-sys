"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createTeam, updateTeam } from "@/server/actions/teams";
import type { ActionResult } from "@/types";

interface ManagerOption { id: string; name: string | null; email: string; }

interface TeamFormProps {
  mode: "create" | "edit";
  teamId?: string;
  defaultValues?: { nameAr?: string; nameEn?: string; managerId?: string };
  managers: ManagerOption[];
}

const INITIAL: ActionResult = { success: false };

export function TeamForm({ mode, teamId, defaultValues, managers }: TeamFormProps) {
  const router = useRouter();

  const action =
    mode === "create"
      ? createTeam
      : (prev: ActionResult, formData: FormData) =>
          updateTeam(teamId!, prev, formData);

  const [state, formAction, isPending] = useActionState(
    action as (prev: ActionResult, formData: FormData) => Promise<ActionResult>,
    INITIAL
  );

  useEffect(() => {
    if (state.success) {
      toast.success(mode === "create" ? "تم إنشاء الفريق" : "تم حفظ التغييرات");
      router.push("/ar/teams");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, mode, router]);

  return (
    <form action={formAction}>
      <div className="card p-6 space-y-4 max-w-xl">
        <h3 className="font-semibold text-text-primary">بيانات الفريق</h3>
        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="nameAr" required>اسم الفريق (عربي)</Label>
          <Input id="nameAr" name="nameAr" defaultValue={defaultValues?.nameAr ?? ""} placeholder="فريق الرياض" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nameEn">اسم الفريق (إنجليزي)</Label>
          <Input id="nameEn" name="nameEn" dir="ltr" defaultValue={defaultValues?.nameEn ?? ""} placeholder="Riyadh Team" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="managerId">مدير الفريق</Label>
          <Select name="managerId" defaultValue={defaultValues?.managerId ?? ""}>
            <SelectTrigger id="managerId">
              <SelectValue placeholder="اختر مدير الفريق (اختياري)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">بدون مدير</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.push("/ar/teams")} disabled={isPending}>إلغاء</Button>
          <Button type="submit" loading={isPending}>
            {mode === "create" ? "إنشاء الفريق" : "حفظ التغييرات"}
          </Button>
        </div>
      </div>
    </form>
  );
}
