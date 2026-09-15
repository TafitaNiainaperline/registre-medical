export type DashboardMonth = { year: number; month: number }

export async function loadDashboardMonth(period: DashboardMonth) {
  const [records, total, list, cashOutflowTotal] = await Promise.all([
    window.api.fetchRecordsByArchive(period),
    window.api.getDispensationTotal(period),
    window.api.getDispensations(),
    window.api.getCashOutflowTotal(period),
  ])
  const monthKey = `${period.year}-${String(period.month).padStart(2, '0')}`
  return {
    records: records || [],
    dispensations: {
      total: Number(total) || 0,
      count: (list || []).filter((row) => row.created_at?.slice(0, 7) === monthKey).length,
    },
    cashOutflowTotal: Number(cashOutflowTotal) || 0,
  }
}
