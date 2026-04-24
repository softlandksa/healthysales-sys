"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

type FormData = z.infer<typeof schema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/ar/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setAuthError("بيانات الدخول غير صحيحة. تحقق من البريد وكلمة المرور.");
    } else if (result?.ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-sm"
    >
      {/* Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-card bg-brand-600 text-white text-2xl font-bold mb-4 shadow-card">
          م
        </div>
        <h1 className="text-2xl font-bold text-text-primary">نظام إدارة المبيعات</h1>
        <p className="mt-1.5 text-sm text-text-secondary">سجّل دخولك للمتابعة</p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card p-6 space-y-4"
        noValidate
      >
        {/* Auth error */}
        {authError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-2.5 rounded-card bg-danger-50 border border-danger-500/30 p-3 text-sm text-danger-600"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{authError}</span>
          </motion.div>
        )}

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" required>البريد الإلكتروني</Label>
          <Input
            {...register("email")}
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="user@example.com"
            error={!!errors.email}
          />
          {errors.email && (
            <p className="text-xs text-danger-600">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" required>كلمة المرور</Label>
          <div className="relative">
            <Input
              {...register("password")}
              id="password"
              type={showPassword ? "text" : "password"}
              dir="ltr"
              autoComplete="current-password"
              placeholder="••••••••"
              error={!!errors.password}
              className="pl-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-danger-600">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          loading={isSubmitting}
          size="lg"
        >
          {isSubmitting ? "جارٍ التحقق…" : "تسجيل الدخول"}
        </Button>
      </form>
    </motion.div>
  );
}
