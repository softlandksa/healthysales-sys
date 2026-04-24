// Domain types — Phase 3

export type UserRole =
  | "admin"
  | "general_manager"
  | "sales_manager"
  | "team_manager"
  | "sales_rep";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "مدير النظام",
  general_manager: "المدير العام",
  sales_manager: "مدير المبيعات",
  team_manager: "مدير الفريق",
  sales_rep: "مندوب مبيعات",
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 5,
  general_manager: 4,
  sales_manager: 3,
  team_manager: 2,
  sales_rep: 1,
};

export type TransactionType =
  | "opening_balance"
  | "sale"
  | "collection"
  | "return_credit"
  | "adjustment";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  opening_balance: "رصيد افتتاحي",
  sale: "مبيعات",
  collection: "تحصيل",
  return_credit: "مرتجع",
  adjustment: "تسوية",
};

export type VisitType = "visit_only" | "sale" | "collection";

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  visit_only: "زيارة",
  sale: "بيع",
  collection: "تحصيل",
};

export type SalesOrderStatus =
  | "draft"
  | "confirmed"
  | "delivered"
  | "collected"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  draft: "مسودة",
  confirmed: "مؤكد",
  delivered: "مُسلَّم",
  collected: "محصَّل",
  cancelled: "ملغى",
};

export const ORDER_STATUS_COLORS: Record<SalesOrderStatus, string> = {
  draft:     "secondary",
  confirmed: "warning",
  delivered: "default",
  collected: "success",
  cancelled: "danger",
};

export type PaymentMethod = "cash" | "bank_transfer" | "check";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
};

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface KpiMetric {
  label: string;
  value: number;
  change: number;
  changeType: "increase" | "decrease";
}

// Session user — matches JWT payload
export interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  teamId: string | null;
  managerId: string | null;
  image?: string | null;
}

// User list row (no password)
export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  teamId: string | null;
  teamNameAr: string | null;
  managerId: string | null;
  managerName: string | null;
  createdAt: Date;
}

// Team list row
export interface TeamRow {
  id: string;
  nameAr: string;
  nameEn: string | null;
  managerId: string | null;
  managerName: string | null;
  memberCount: number;
  createdAt: Date;
}

// Product list row
export interface ProductRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  unit: string;
  price: string;
  isActive: boolean;
  createdAt: Date;
}

// Customer list row
export interface CustomerRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  phone: string | null;
  balance: string;
  creditLimit: string | null;
  isActive: boolean;
  assignedToName: string | null;
  teamNameAr: string | null;
  regionNameAr: string | null;
  createdAt: Date;
}

// Customer transaction row
export interface TransactionRow {
  id: string;
  type: TransactionType;
  amount: string;
  balance: string;
  description: string | null;
  reference: string | null;
  transactionDate: Date;
  createdByName: string | null;
}

// Visit list row
export interface VisitRow {
  id: string;
  code: string;
  visitType: VisitType;
  customerNameAr: string;
  customerId: string;
  repName: string | null;
  repId: string;
  notes: string | null;
  hasSale: boolean;
  hasCollection: boolean;
  visitedAt: Date;
}

// Sales order list row
export interface SalesOrderRow {
  id: string;
  code: string;
  status: SalesOrderStatus;
  customerNameAr: string;
  customerId: string;
  repName: string | null;
  repId: string;
  total: string;
  itemCount: number;
  confirmedAt: Date | null;
  createdAt: Date;
}

// Sales order item row
export interface OrderItemRow {
  id: string;
  productId: string;
  productCode: string;
  productNameAr: string;
  productUnit: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  expiryDate: Date;
}

// Collection list row
export interface CollectionRow {
  id: string;
  code: string;
  customerNameAr: string;
  customerId: string;
  repName: string | null;
  repId: string;
  amount: string;
  method: PaymentMethod;
  isCancelled: boolean;
  collectedAt: Date;
}

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "blocked"
  | "cancelled";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending:     "معلّقة",
  in_progress: "قيد التنفيذ",
  done:        "مكتملة",
  blocked:     "محجوبة",
  cancelled:   "ملغاة",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, "default" | "warning" | "success" | "danger" | "secondary"> = {
  pending:     "secondary",
  in_progress: "warning",
  done:        "success",
  blocked:     "danger",
  cancelled:   "secondary",
};

export interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: Date;
  completedAt: Date | null;
  assignedToName: string | null;
  assignedToId: string;
  assignedByName: string | null;
  isOverdue: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

// ─── Competitions ──────────────────────────────────────────────────────────────

export type CompetitionStatus = "upcoming" | "active" | "ended" | "cancelled";

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  upcoming:  "قادمة",
  active:    "جارية",
  ended:     "منتهية",
  cancelled: "ملغاة",
};

export const COMPETITION_STATUS_COLORS: Record<CompetitionStatus, "default" | "warning" | "success" | "danger" | "secondary"> = {
  upcoming:  "secondary",
  active:    "warning",
  ended:     "success",
  cancelled: "danger",
};

export interface CompetitionRow {
  id: string;
  name: string;
  status: CompetitionStatus;
  productId: string;
  productName: string;
  startDate: Date;
  endDate: Date;
  prize: string;
  createdByName: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string | null;
  team: string | null;
  units: number;
  value: string;
  lastCollectedAt: Date | null;
  isInactive: boolean;
}

// ─── Targets ──────────────────────────────────────────────────────────────────

export type TargetPeriod = "monthly" | "quarterly";
export type TargetMetric = "sales_amount" | "collections_amount" | "visits_count";

export const TARGET_PERIOD_LABELS: Record<TargetPeriod, string> = {
  monthly:   "شهري",
  quarterly: "ربع سنوي",
};

export const TARGET_METRIC_LABELS: Record<TargetMetric, string> = {
  sales_amount:       "مبلغ المبيعات",
  collections_amount: "مبلغ التحصيل",
  visits_count:       "عدد الزيارات",
};

export type AchievementStatus = "ahead" | "on_track" | "at_risk" | "behind";

export const ACHIEVEMENT_STATUS_LABELS: Record<AchievementStatus, string> = {
  ahead:    "متقدم",
  on_track: "في المسار",
  at_risk:  "في خطر",
  behind:   "متأخر",
};

export const ACHIEVEMENT_STATUS_COLORS: Record<AchievementStatus, string> = {
  ahead:    "success",
  on_track: "warning",
  at_risk:  "warning",
  behind:   "danger",
};

export interface Achievement {
  metric: TargetMetric;
  target: number;
  actual: number;
  attainment: number;         // 0–∞ percentage
  projected: number;          // projected end-of-period value
  projectedAttainment: number;
  status: AchievementStatus;
  daysRemaining: number;
  daysElapsed: number;
  percentageOfPeriod: number;
}

export interface TargetRow {
  id: string;
  period: TargetPeriod;
  metric: TargetMetric;
  periodStart: Date;
  periodEnd: Date;
  value: string;
  userName: string | null;
  userId: string;
  createdByName: string | null;
  createdAt: Date;
}
