"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface PreviewRow {
  rowNum:   number;
  code:     string;
  nameAr:   string;
  nameEn:   string;
  unit:     string;
  price:    string;
  isActive: boolean;
  errors:   string[];
  valid:    boolean;
}

interface ProductExcelActionsProps {
  canImport: boolean;
}

export function ProductExcelActions({ canImport }: ProductExcelActionsProps) {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [open,         setOpen]         = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [importing,    setImporting]    = useState(false);
  const [preview,      setPreview]      = useState<PreviewRow[] | null>(null);
  const [validCount,   setValidCount]   = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleTemplateDownload() {
    window.location.href = "/api/products/template";
  }

  function handleExport() {
    window.location.href = "/api/products/export";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/products/import?action=preview", { method: "POST", body: fd });
      const data = await res.json() as { rows: PreviewRow[]; validCount: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "حدث خطأ أثناء قراءة الملف");
      setPreview(data.rows);
      setValidCount(data.validCount);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر قراءة الملف");
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!selectedFile) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res  = await fetch("/api/products/import?action=import", { method: "POST", body: fd });
      const data = await res.json() as { saved?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "حدث خطأ أثناء الاستيراد");
      toast.success(`تم استيراد ${data.saved} منتج بنجاح`);
      handleOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الاستيراد");
    } finally {
      setImporting(false);
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setPreview(null);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canImport && (
          <>
            <Button variant="outline" size="sm" onClick={handleTemplateDownload} type="button">
              <FileSpreadsheet size={14} />
              قالب الاستيراد
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)} type="button">
              <Upload size={14} />
              استيراد
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={handleExport} type="button">
          <Download size={14} />
          تصدير Excel
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>استيراد منتجات من Excel</DialogTitle>
            <DialogDescription>
              ارفع ملف Excel يحتوي على بيانات المنتجات. حمّل القالب أولاً للتأكد من تطابق الأعمدة.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            {/* File picker */}
            <div className="flex items-center gap-3 flex-wrap">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                type="button"
              >
                {loading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Upload size={14} />}
                {selectedFile ? "تغيير الملف" : "اختر ملف Excel"}
              </Button>
              {selectedFile && !loading && (
                <span className="text-sm text-text-muted truncate max-w-xs">{selectedFile.name}</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleTemplateDownload}
                type="button"
                className="mr-auto"
              >
                <FileSpreadsheet size={13} />
                تحميل القالب
              </Button>
            </div>

            {/* Summary badges */}
            {preview && (
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-success-600 font-medium">
                  <CheckCircle2 size={15} />
                  {validCount} صف صالح
                </span>
                {preview.length - validCount > 0 && (
                  <span className="flex items-center gap-1.5 text-danger-600 font-medium">
                    <XCircle size={15} />
                    {preview.length - validCount} صف به أخطاء (سيُتجاهل)
                  </span>
                )}
                <span className="text-text-muted">الإجمالي: {preview.length} صف</span>
              </div>
            )}

            {/* Preview table */}
            {preview && (
              <div className="border border-border rounded-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-1 sticky top-0">
                      <tr>
                        <th className="text-right px-3 py-2 font-medium text-text-secondary">#</th>
                        <th className="text-right px-3 py-2 font-medium text-text-secondary">الكود</th>
                        <th className="text-right px-3 py-2 font-medium text-text-secondary">الاسم العربي</th>
                        <th className="text-right px-3 py-2 font-medium text-text-secondary">الوحدة</th>
                        <th className="text-right px-3 py-2 font-medium text-text-secondary">السعر</th>
                        <th className="text-right px-3 py-2 font-medium text-text-secondary">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.map((row) => (
                        <tr
                          key={row.rowNum}
                          className={row.valid ? "hover:bg-surface-1" : "bg-danger-50"}
                        >
                          <td className="px-3 py-2 text-text-muted num">{row.rowNum}</td>
                          <td className="px-3 py-2 font-mono">{row.code || <span className="text-danger-400">—</span>}</td>
                          <td className="px-3 py-2">{row.nameAr || <span className="text-danger-400">—</span>}</td>
                          <td className="px-3 py-2">{row.unit || <span className="text-danger-400">—</span>}</td>
                          <td className="px-3 py-2 num">{row.price || <span className="text-danger-400">—</span>}</td>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <CheckCircle2 size={14} className="text-success-600" />
                            ) : (
                              <div className="space-y-0.5">
                                {row.errors.map((e, i) => (
                                  <p key={i} className="text-danger-600 text-[10px] leading-tight">{e}</p>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} type="button">
              إلغاء
            </Button>
            {preview && validCount > 0 && (
              <Button onClick={handleImport} disabled={importing} type="button">
                {importing && <Loader2 size={14} className="animate-spin" />}
                استيراد {validCount} منتج
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
