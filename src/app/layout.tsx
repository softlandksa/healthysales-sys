import type { Metadata } from "next";
import { ibmPlexArabic } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "نظام إدارة المبيعات الميداني",
    template: "%s | نظام المبيعات",
  },
  description: "نظام متكامل لإدارة فريق المبيعات الميداني في السوق السعودي",
  applicationName: "Sales Sys",
  keywords: ["مبيعات", "إدارة", "ميداني", "السعودية"],
  authors: [{ name: "Sales Sys" }],
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlexArabic.variable}>
      <body>{children}</body>
    </html>
  );
}
