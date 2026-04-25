"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe } from "lucide-react";
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
import { createRegion, updateRegion, deleteRegion } from "@/server/actions/settings";
import type { ActionResult } from "@/types";

interface Region {
  id: string;
  nameAr: string;
  nameEn: string;
  _count: { customers: number };
}

interface Props {
  regions: Region[];
  isAdmin: boolean;
}

const INITIAL: ActionResult = { success: false };

function RegionDialog({
  open,
  onClose,
  region,
}: {
  open: boolean;
  onClose: () => void;
  region?: Region;
}) {
  const router = useRouter();
  const action = region
    ? (prev: ActionResult, fd: FormData) => updateRegion(region.id, prev, fd)
    : createRegion;

  const [state, formAction, isPending] = useActionState(
    action as (prev: ActionResult, fd: FormData) => Promise<ActionResult>,
    INITIAL
  );

  useEffect(() => {
    if (state.success) {
      toast.success(region ? "تم تحديث المنطقة" : "تم إضافة المنطقة");
      router.refresh();
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, region, router, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{region ? "تعديل المنطقة" : "إضافة منطقة"}</DialogTitle>
          <DialogDescription>
            {region ? `تعديل بيانات المنطقة: ${region.nameAr}` : "أدخل بيانات المنطقة الجديدة"}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nameAr" required>الاسم بالعربي</Label>
            <Input
              id="nameAr"
              name="nameAr"
              defaultValue={region?.nameAr ?? ""}
              placeholder="الرياض"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nameEn" required>الاسم بالإنجليزي</Label>
            <Input
              id="nameEn"
              name="nameEn"
              dir="ltr"
              defaultValue={region?.nameEn ?? ""}
              placeholder="Riyadh"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              إلغاء
            </Button>
            <Button type="submit" loading={isPending}>
              {region ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegionsTab({ regions, isAdmin }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Region | undefined>();
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function openEdit(r: Region) {
    setEditTarget(r);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteRegion(id);
      if (result.success) {
        toast.success("تم حذف المنطقة");
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
            إضافة منطقة
          </Button>
        </div>
      )}

      <div className="card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم بالعربي</TableHead>
              <TableHead>الاسم بالإنجليزي</TableHead>
              <TableHead className="text-center">عدد العملاء</TableHead>
              {isAdmin && <TableHead className="text-center">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {regions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 4 : 3} className="h-32 text-center text-text-muted">
                  <div className="flex flex-col items-center gap-2">
                    <Globe size={32} className="text-border-strong" />
                    <span>لا توجد مناطق بعد</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              regions.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nameAr}</TableCell>
                  <TableCell className="text-text-secondary dir-ltr">{r.nameEn}</TableCell>
                  <TableCell className="text-center num text-text-secondary">
                    {r._count.customers}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="تعديل"
                          onClick={() => openEdit(r)}
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
                              disabled={isPending || r._count.customers > 0}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف المنطقة</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل تريد حذف منطقة &ldquo;{r.nameAr}&rdquo;؟ لا يمكن التراجع.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(r.id)}
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

      <RegionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        {...(editTarget ? { region: editTarget } : {})}
      />
    </div>
  );
}
