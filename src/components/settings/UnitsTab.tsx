"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { createProductUnit, updateProductUnit, deleteProductUnit } from "@/server/actions/settings";
import type { ActionResult } from "@/types";

interface ProductUnitRow { id: string; nameAr: string; isActive: boolean }
interface Props { units: ProductUnitRow[]; isAdmin: boolean }

const INITIAL: ActionResult = { success: false };

function UnitDialog({
  open,
  onClose,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  unit?: ProductUnitRow;
}) {
  const router = useRouter();
  const action = unit
    ? (prev: ActionResult, fd: FormData) => updateProductUnit(unit.id, prev, fd)
    : createProductUnit;

  const [state, formAction, isPending] = useActionState(
    action as (prev: ActionResult, fd: FormData) => Promise<ActionResult>,
    INITIAL
  );

  useEffect(() => {
    if (state.success) {
      toast.success(unit ? "تم تحديث الوحدة" : "تم إضافة الوحدة");
      router.refresh();
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, unit, router, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{unit ? "تعديل الوحدة" : "إضافة وحدة"}</DialogTitle>
          <DialogDescription>
            {unit ? `تعديل اسم وحدة القياس: ${unit.nameAr}` : "أدخل اسم وحدة القياس الجديدة"}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nameAr" required>اسم الوحدة</Label>
            <Input
              id="nameAr"
              name="nameAr"
              defaultValue={unit?.nameAr ?? ""}
              placeholder="قطعة"
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              إلغاء
            </Button>
            <Button type="submit" loading={isPending}>
              {unit ? "حفظ" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UnitsTab({ units, isAdmin }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductUnitRow | undefined>();
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function openEdit(u: ProductUnitRow) {
    setEditTarget(u);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteProductUnit(id);
      if (result.success) {
        toast.success("تم حذف الوحدة");
        router.refresh();
      } else {
        toast.error(result.error ?? "حدث خطأ");
      }
    });
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} />
            إضافة وحدة
          </Button>
        </div>
      )}

      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الوحدة</TableHead>
              {isAdmin && <TableHead className="text-center w-24">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 2 : 1} className="h-32 text-center text-text-muted">
                  <div className="flex flex-col items-center gap-2">
                    <Package size={32} className="text-border-strong" />
                    <span>لا توجد وحدات بعد</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nameAr}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="تعديل"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil size={15} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:text-danger-600"
                              title="حذف"
                              disabled={isPending}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف الوحدة</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل تريد حذف وحدة &ldquo;{u.nameAr}&rdquo;؟ لا يمكن التراجع.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(u.id)}
                                className="bg-danger-600 hover:bg-danger-500"
                              >
                                حذف
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

      <UnitDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        {...(editTarget ? { unit: editTarget } : {})}
      />
    </div>
  );
}
