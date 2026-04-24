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

// ─── Export helpers ───────────────────────────────────────────────────────────

export type ReportType =
  | "rep"
  | "team"
  | "customers"
  | "expiry"
  | "collections"
  | "competitions"
  | "heatmap";

export type ExportFormat = "xlsx" | "csv";
