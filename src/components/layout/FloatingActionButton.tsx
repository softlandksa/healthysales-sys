"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import type { UserRole } from "@/types";

interface FloatingActionButtonProps {
  role: UserRole;
}

export function FloatingActionButton({ role }: FloatingActionButtonProps) {
  if (role !== "sales_rep") return null;

  return (
    <motion.div
      className="md:hidden fixed bottom-20 left-4 z-50"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
    >
      <Link
        href="/ar/visits/new"
        className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-brand-300"
        aria-label="زيارة جديدة"
      >
        <Plus size={26} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}
