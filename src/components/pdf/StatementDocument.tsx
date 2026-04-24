import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { TransactionType } from "@/types";
import { TRANSACTION_TYPE_LABELS } from "@/types";

// Register a font that supports Arabic (Noto Sans Arabic is freely available).
// Fallback: if font fails, @react-pdf will use Helvetica which won't render Arabic
// glyphs correctly — acceptable for the MVP; swap for a proper hosted URL in prod.
Font.register({
  family: "NotoArabic",
  src: "https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyyu3.ttf",
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoArabic",
    fontSize: 9,
    padding: 30,
    direction: "rtl",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 16,
    borderBottom: "1pt solid #e2e8f0",
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
    textAlign: "right",
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "right",
  },
  summaryRow: {
    flexDirection: "row-reverse",
    gap: 16,
    marginBottom: 14,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 8,
    border: "1pt solid #e2e8f0",
  },
  summaryLabel: { fontSize: 8, color: "#64748b", marginBottom: 2, textAlign: "right" },
  summaryValue: { fontSize: 11, fontWeight: "bold", textAlign: "right", color: "#1e293b" },
  table: { width: "100%" },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: "#f1f5f9",
    borderRadius: 2,
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row-reverse",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottom: "0.5pt solid #e2e8f0",
  },
  tableRowAlt: { backgroundColor: "#f8fafc" },
  thDate:  { width: "14%", textAlign: "right", fontSize: 8, fontWeight: "bold", color: "#64748b" },
  thType:  { width: "14%", textAlign: "right", fontSize: 8, fontWeight: "bold", color: "#64748b" },
  thDesc:  { width: "28%", textAlign: "right", fontSize: 8, fontWeight: "bold", color: "#64748b" },
  thDebit: { width: "15%", textAlign: "right", fontSize: 8, fontWeight: "bold", color: "#64748b" },
  thCredit:{ width: "15%", textAlign: "right", fontSize: 8, fontWeight: "bold", color: "#64748b" },
  thBal:   { width: "14%", textAlign: "right", fontSize: 8, fontWeight: "bold", color: "#64748b" },
  tdDate:  { width: "14%", textAlign: "right", color: "#64748b" },
  tdType:  { width: "14%", textAlign: "right" },
  tdDesc:  { width: "28%", textAlign: "right", color: "#475569" },
  tdDebit: { width: "15%", textAlign: "right", color: "#dc2626" },
  tdCredit:{ width: "15%", textAlign: "right", color: "#16a34a" },
  tdBal:   { width: "14%", textAlign: "right", fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 7,
    color: "#94a3b8",
    borderTop: "0.5pt solid #e2e8f0",
    paddingTop: 6,
  },
});

interface TxRow {
  id: string;
  type: TransactionType;
  amount: string;
  balance: string;
  description: string | null;
  reference: string | null;
  transactionDate: Date;
}

interface StatementDocumentProps {
  customerCode: string;
  customerName: string;
  balance: string;
  openingBalance: string;
  fromDate?: string;
  toDate?: string;
  rows: TxRow[];
  generatedAt: string;
}

function formatAmt(s: string) {
  return parseFloat(s).toLocaleString("en-US", { minimumFractionDigits: 2 }) + " ر.س";
}

export function StatementDocument({
  customerCode,
  customerName,
  balance,
  openingBalance,
  fromDate,
  toDate,
  rows,
  generatedAt,
}: StatementDocumentProps) {
  const balNum = parseFloat(balance);

  return (
    <Document title={`كشف حساب — ${customerName}`} language="ar">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>كشف حساب عميل</Text>
          <Text style={styles.subtitle}>
            {customerName} — {customerCode}
          </Text>
          {(fromDate || toDate) && (
            <Text style={styles.subtitle}>
              الفترة: {fromDate || "البداية"} إلى {toDate || "اليوم"}
            </Text>
          )}
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>الرصيد الحالي</Text>
            <Text style={[styles.summaryValue, { color: balNum > 0 ? "#dc2626" : "#16a34a" }]}>
              {formatAmt(balance)}
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>الرصيد الافتتاحي</Text>
            <Text style={styles.summaryValue}>{formatAmt(openingBalance)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>عدد الحركات</Text>
            <Text style={styles.summaryValue}>{rows.length}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.thDate}>التاريخ</Text>
            <Text style={styles.thType}>النوع</Text>
            <Text style={styles.thDesc}>البيان</Text>
            <Text style={styles.thDebit}>مدين</Text>
            <Text style={styles.thCredit}>دائن</Text>
            <Text style={styles.thBal}>الرصيد</Text>
          </View>

          {rows.map((row, i) => {
            const isDebit = ["opening_balance", "sale", "adjustment"].includes(row.type);
            const bal = parseFloat(row.balance);
            return (
              <View
                key={row.id}
                style={[styles.tableRow, ...(i % 2 === 1 ? [styles.tableRowAlt] : [])]}
              >
                <Text style={styles.tdDate}>
                  {new Date(row.transactionDate).toLocaleDateString("en-SA")}
                </Text>
                <Text style={styles.tdType}>
                  {TRANSACTION_TYPE_LABELS[row.type]}
                </Text>
                <Text style={styles.tdDesc}>
                  {row.description ?? ""}
                  {row.reference ? ` (${row.reference})` : ""}
                </Text>
                <Text style={styles.tdDebit}>
                  {isDebit ? formatAmt(row.amount) : ""}
                </Text>
                <Text style={styles.tdCredit}>
                  {!isDebit ? formatAmt(row.amount) : ""}
                </Text>
                <Text style={[styles.tdBal, { color: bal > 0 ? "#dc2626" : "#16a34a" }]}>
                  {formatAmt(row.balance)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          تم الإنشاء بتاريخ: {generatedAt} — نظام المبيعات الميداني
        </Text>
      </Page>
    </Document>
  );
}
