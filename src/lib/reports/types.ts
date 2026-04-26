// Shared report types for Phase 7

export interface DateRangeFilter {
  from: Date;
  to:   Date;
}

// ─── 1. Individual Rep ────────────────────────────────────────────────────────

export interface RepReportFilters extends DateRangeFilter {
  repId: string;
}

export interface RepSummary {
  totalSales:       number;
  totalCollections: number;
  totalVisits:      number;
  totalOrders:      number;
  avgOrderValue:    number;
  openOrders:       number;
}

export interface MonthPoint {
  month:       string; // "YYYY-MM"
  sales:       number;
  collections: number;
  visits:      number;
}

export interface TopCustomerRow {
  customerId:   string;
  customerName: string;
  sales:        number;
  visits:       number;
}

export interface TopProductRow {
  productId:   string;
  productCode: string;
  productName: string;
  units:       number;
  revenue:     number;
}

export interface RepReportData {
  rep:           { id: string; name: string | null; email: string };
  summary:       RepSummary;
  monthlyTrend:  MonthPoint[];
  topCustomers:  TopCustomerRow[];
  topProducts:   TopProductRow[];
  ordersByStatus: Record<string, number>;
}

// ─── 2. Team Report ───────────────────────────────────────────────────────────

export interface TeamReportFilters extends DateRangeFilter {
  teamId?: string;
}

export interface TeamSummaryRow {
  teamId:      string;
  teamName:    string;
  sales:       number;
  collections: number;
  visits:      number;
  repCount:    number;
}

export interface RepCompareRow {
  repId:       string;
  repName:     string | null;
  teamId:      string;
  teamName:    string;
  sales:       number;
  collections: number;
  visits:      number;
}

export interface TeamReportData {
  teams: TeamSummaryRow[];
  reps:  RepCompareRow[];
}

// ─── 3. Customers Report ──────────────────────────────────────────────────────

export interface CustomersReportFilters extends DateRangeFilter {
  repId?:  string;
  teamId?: string;
}

export type CustomerCategory = "A" | "B" | "C";

export interface CustomerBuyerRow {
  customerId: string;
  name:       string;
  sales:      number;
  orders:     number;
  category:   CustomerCategory;
}

export interface CustomerBalanceRow {
  customerId:  string;
  name:        string;
  balance:     number;
  creditLimit: number | null;
  repName:     string | null;
}

export interface CustomerVisitRow {
  customerId: string;
  name:       string;
  visits:     number;
  lastVisit:  Date | null;
}

export interface CustomersReportData {
  topBuyers:      CustomerBuyerRow[];
  highBalances:   CustomerBalanceRow[];
  visitFrequency: CustomerVisitRow[];
  summary: {
    totalCustomers:  number;
    totalOutstanding: number;
    avgBalance:      number;
  };
}

// ─── 4. Expiry Report ─────────────────────────────────────────────────────────

export type ExpiryStatus = "fresh" | "warning" | "critical" | "expired";

export interface ExpiryReportFilters extends DateRangeFilter {
  repId?:  string;
  status?: ExpiryStatus;
}

export interface ExpiryItemRow {
  orderItemId:  string;
  orderId:      string;
  orderCode:    string;
  productId:    string;
  productName:  string;
  productCode:  string;
  repId:        string;
  repName:      string | null;
  quantity:     number;
  expiryDate:   Date;
  daysUntilExpiry: number;
  status:       ExpiryStatus;
}

export interface ExpiryReportData {
  items:   ExpiryItemRow[];
  summary: Record<ExpiryStatus, number>;
}

// ─── 5. Collections Report ────────────────────────────────────────────────────

export interface CollectionsReportFilters extends DateRangeFilter {
  repId?:  string;
  teamId?: string;
}

export interface CollectionMethodRow {
  method: string;
  label:  string;
  amount: number;
  count:  number;
  pct:    number;
}

export interface CollectionRepRow {
  repId:   string;
  repName: string | null;
  amount:  number;
  count:   number;
}

export interface CollectionMonthPoint {
  month:    string;
  cash:     number;
  transfer: number;
  check:    number;
}

export interface CollectionsReportData {
  byMethod:      CollectionMethodRow[];
  topCollectors: CollectionRepRow[];
  monthlyTrend:  CollectionMonthPoint[];
  summary: {
    total:     number;
    count:     number;
    avgAmount: number;
  };
}

// ─── 6. Competitions Report ───────────────────────────────────────────────────

export interface CompetitionsReportFilters extends DateRangeFilter {
  status?: string;
}

export interface CompetitionHistoryRow {
  id:               string;
  name:             string;
  status:           string;
  startDate:        Date;
  endDate:          Date;
  prize:            string;
  productName:      string;
  participantCount: number;
  winners:          Array<{ rank: number; name: string | null }>;
}

export interface TopWinnerRow {
  userId: string;
  name:   string | null;
  wins:   number;
}

export interface CompetitionsReportData {
  competitions: CompetitionHistoryRow[];
  topWinners:   TopWinnerRow[];
  summary: {
    total:  number;
    active: number;
    ended:  number;
  };
}

// ─── 7. Activity Heatmap ──────────────────────────────────────────────────────

export interface ActivityHeatmapFilters extends DateRangeFilter {
  repId?:  string;
  teamId?: string;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0=Sun ... 6=Sat (PostgreSQL DOW)
  hour:      number; // 0–23
  count:     number;
}

export interface RepActivityRow {
  repId:      string;
  repName:    string | null;
  totalVisits: number;
}

export interface ActivityHeatmapData {
  heatmap:     HeatmapCell[];
  repActivity: RepActivityRow[];
  peakDay:     number;
  peakHour:    number;
  totalVisits: number;
}

// ─── 8. Sales Report ─────────────────────────────────────────────────────────

export interface SalesReportFilters extends DateRangeFilter {
  repId?:  string;
  teamId?: string;
  status?: string;
}

export interface SalesRepRow {
  repId:   string;
  repName: string | null;
  orders:  number;
  amount:  number;
}

export interface SalesProductRow {
  productId:   string;
  productName: string;
  productCode: string;
  unit:        string;
  quantity:    number;
  revenue:     number;
}

export interface SalesOrderDetailRow {
  id:           string;
  code:         string;
  customerName: string;
  repName:      string | null;
  status:       string;
  total:        number;
  createdAt:    Date;
}

export interface SalesReportData {
  summary: {
    totalOrders:    number;
    totalAmount:    number;
    avgOrderValue:  number;
    confirmedCount: number;
    collectedCount: number;
    cancelledCount: number;
    deliveredCount: number;
  };
  byRep:     SalesRepRow[];
  byProduct: SalesProductRow[];
  orders:    SalesOrderDetailRow[];
}

// ─── 9. Visits Report ────────────────────────────────────────────────────────

export interface VisitsReportFilters extends DateRangeFilter {
  repId?:     string;
  visitType?: string;
}

export interface VisitRepRow {
  repId:      string;
  repName:    string | null;
  total:      number;
  visitOnly:  number;
  sale:       number;
  collection: number;
}

export interface VisitDetailRow {
  id:           string;
  visitedAt:    Date;
  customerName: string;
  repName:      string | null;
  visitType:    string;
  notes:        string | null;
}

export interface VisitsReportData {
  summary: {
    total:           number;
    uniqueCustomers: number;
    avgPerDay:       number;
    visitOnly:       number;
    sale:            number;
    collection:      number;
  };
  byRep:  VisitRepRow[];
  visits: VisitDetailRow[];
}

// ─── 10. Tasks Report ────────────────────────────────────────────────────────

export interface TasksReportFilters extends DateRangeFilter {
  assignedToId?: string;
  status?:       string;
}

export interface TaskAssigneeRow {
  userId:     string;
  userName:   string | null;
  total:      number;
  done:       number;
  pending:    number;
  inProgress: number;
  blocked:    number;
}

export interface TaskDetailRow {
  id:         string;
  title:      string;
  status:     string;
  dueDate:    Date;
  assignedTo: string | null;
  assignedBy: string | null;
  isOverdue:  boolean;
  createdAt:  Date;
}

export interface TasksReportData {
  summary: {
    total:      number;
    pending:    number;
    inProgress: number;
    done:       number;
    blocked:    number;
    cancelled:  number;
    overdue:    number;
  };
  byAssignee: TaskAssigneeRow[];
  tasks:      TaskDetailRow[];
}

// ─── 11. Products Report ─────────────────────────────────────────────────────

export interface ProductsReportFilters extends DateRangeFilter {
  isActive?: boolean;
}

export interface ProductSalesRow {
  productId:    string;
  productName:  string;
  productCode:  string;
  unit:         string;
  price:        number;
  isActive:     boolean;
  quantitySold: number;
  revenue:      number;
}

export interface ProductsReportData {
  summary: {
    total:        number;
    active:       number;
    inactive:     number;
    totalRevenue: number;
  };
  products: ProductSalesRow[];
}

// ─── 12. Targets Report ──────────────────────────────────────────────────────

export interface TargetsReportFilters extends DateRangeFilter {
  userId?:  string;
  metric?:  string;
}

export interface TargetDetailRow {
  id:          string;
  userId:      string;
  userName:    string | null;
  metric:      string;
  period:      string;
  periodStart: Date;
  periodEnd:   Date;
  targetValue: number;
  actual:      number | null;
  pct:         number | null;
}

export interface TargetsReportData {
  summary: {
    totalTargets:   number;
    uniqueUsers:    number;
    avgAchievement: number;
    fullyAchieved:  number;
    atRisk:         number;
  };
  targets:  TargetDetailRow[];
  byMetric: { metric: string; count: number; avgAchievement: number }[];
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export type ReportType =
  | "rep"
  | "team"
  | "customers"
  | "expiry"
  | "collections"
  | "competitions"
  | "heatmap"
  | "sales"
  | "visits"
  | "tasks"
  | "products"
  | "targets";

export type ExportFormat = "xlsx" | "csv";
