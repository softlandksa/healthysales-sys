"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center p-8">
      <div className="w-14 h-14 rounded-full bg-danger-50 flex items-center justify-center">
        <AlertCircle size={28} className="text-danger-500" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">حدث خطأ غير متوقع</h2>
        <p className="text-sm text-text-secondary mt-1">
          {error.message || "تعذر تحميل هذه الصفحة. يرجى المحاولة مرة أخرى."}
        </p>
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        إعادة المحاولة
      </Button>
    </div>
  );
}
