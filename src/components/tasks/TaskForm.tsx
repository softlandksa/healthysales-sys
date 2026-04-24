"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { createTask } from "@/server/actions/tasks";
import type { ActionResult } from "@/types";

interface TaskFormProps {
  userOptions: ComboboxOption[];
}

export function TaskForm({ userOptions }: TaskFormProps) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(createTask, { success: false } as ActionResult<{ id: string }>);
  const [assignedToId, setAssignedToId] = useState("");

  useEffect(() => {
    if (state.success && state.data) {
      toast.success("تم إنشاء المهمة");
      router.push(`/ar/tasks/${state.data.id}`);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  // Min date = today in Riyadh (use local approach)
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="assignedToId" value={assignedToId} />

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-sm font-semibold">
          عنوان المهمة <span className="text-danger-500">*</span>
        </Label>
        <Input
          id="title"
          name="title"
          placeholder="وصف قصير وواضح للمهمة..."
          maxLength={200}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-semibold">التفاصيل</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="تفاصيل إضافية، متطلبات، ملاحظات..."
          rows={4}
          maxLength={2000}
        />
      </div>

      {/* Assignee */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          إسناد إلى <span className="text-danger-500">*</span>
        </Label>
        <Combobox
          options={userOptions}
          value={assignedToId}
          onChange={setAssignedToId}
          placeholder="اختر عضو الفريق..."
          searchPlaceholder="ابحث بالاسم..."
          emptyText="لا توجد نتائج"
        />
      </div>

      {/* Due date */}
      <div className="space-y-2">
        <Label htmlFor="dueDate" className="text-sm font-semibold">
          تاريخ الاستحقاق <span className="text-danger-500">*</span>
        </Label>
        <Input
          id="dueDate"
          name="dueDate"
          type="date"
          min={todayStr}
          required
          className="num max-w-xs"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending || !assignedToId}
          className="flex-1 sm:flex-none sm:min-w-32"
        >
          {isPending && <Loader2 size={15} className="animate-spin" />}
          إسناد المهمة
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          إلغاء
        </Button>
      </div>
    </form>
  );
}
