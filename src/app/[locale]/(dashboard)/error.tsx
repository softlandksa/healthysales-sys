"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
      <div className="p-4 rounded-full bg-danger-50">
        <AlertTriangle size={28} className="text-danger-600" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary">حدث خطأ أثناء تحميل الصفحة</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          {error.message || "يرجى المحاولة مجدداً أو التواصل مع الدعم الفني."}
        </p>
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        إعادة المحاولة
      </Button>
    </div>
  );
}
