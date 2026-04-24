"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { RoleBadge, StatusBadge } from "./RoleBadge";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

export interface HierarchyNode {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  children: HierarchyNode[];
}

interface NodeProps {
  node: HierarchyNode;
  depth: number;
}

function TreeNode({ node, depth }: NodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-button transition-colors",
          "hover:bg-surface-2 cursor-pointer group"
        )}
        style={{ paddingRight: `${depth * 24 + 12}px` }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {/* Expand toggle */}
        <span className="w-4 shrink-0 text-text-muted">
          {hasChildren ? (
            open ? <ChevronDown size={14} /> : <ChevronLeft size={14} />
          ) : null}
        </span>

        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
          {node.name?.[0] ?? node.email[0]?.toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-text-primary">
            {node.name ?? node.email}
          </span>
          <span className="text-xs text-text-muted mr-2 hidden sm:inline">{node.email}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <RoleBadge role={node.role} />
          {!node.isActive && <StatusBadge isActive={false} />}
        </div>

        {hasChildren && (
          <span className="num text-xs text-text-muted">{node.children.length}</span>
        )}
      </div>

      {hasChildren && open && (
        <div className="border-r border-border mr-6">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface HierarchyTreeProps {
  roots: HierarchyNode[];
}

export function HierarchyTree({ roots }: HierarchyTreeProps) {
  if (roots.length === 0) {
    return (
      <div className="card p-12 text-center text-text-muted">
        <p>لا توجد بيانات هيكل تنظيمي</p>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-1">
      {roots.map((node) => (
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
