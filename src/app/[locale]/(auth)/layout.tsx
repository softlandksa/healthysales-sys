export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-surface-1 via-brand-50 to-surface-2 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        {children}
      </div>
      <footer className="text-center py-4 text-xs text-text-muted">
        © {new Date().getFullYear()} نظام إدارة المبيعات الميداني — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
