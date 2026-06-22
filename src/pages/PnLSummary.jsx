import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { TrendingUp, Target, AlertCircle } from 'lucide-react';
import './PnLSummary.css';

const MONTH_LABELS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getPreviousMonths(count, currentMonth, currentYear) {
  const result = [];
  let m = parseInt(currentMonth);
  let y = parseInt(currentYear);
  for (let i = 0; i < count; i++) {
    result.push({ year: String(y), month: String(m).padStart(2, '0') });
    m--;
    if (m < 1) { m = 12; y--; }
  }
  return result;
}

export default function PnLSummary() {
  const {
    currentMonthRecords, currentMonthActive,
    expenses, currentMonth, currentYear,
    exchangeRate, convertToINR, formatUSD, formatINR, profitGoal,
    bankDeposits, monthlyRecords
  } = useContext(AppContext);

  const curMonthName = MONTH_LABELS[parseInt(currentMonth)];

  let nextMonthNum = parseInt(currentMonth) + 1;
  let nextYearNum = parseInt(currentYear);
  if (nextMonthNum > 12) { nextMonthNum = 1; nextYearNum++; }
  const nextMonthName = MONTH_LABELS[nextMonthNum];

  const totalReceived = currentMonthRecords.reduce((sum, r) => sum + (r.paymentReceived || 0), 0);
  const totalRefunds = currentMonthRecords.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
  const totalChargebacks = currentMonthRecords.reduce((sum, r) => sum + (r.chargebackAmount || 0), 0);
  const netCashUSD = totalReceived - totalRefunds - totalChargebacks;
  const netCashINR = convertToINR(netCashUSD);

  const nextMonthMRR_USD = currentMonthActive.reduce((s, r) => s + r.monthlyPrice, 0);
  const nextMonthMRR_INR = convertToINR(nextMonthMRR_USD);

  const monthExpenses = expenses.filter(e => e.month === currentMonth && e.year === currentYear);
  const totalExpensesINR = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExpensesUSD = totalExpensesINR / exchangeRate;

  const grossProfitUSD = netCashUSD - totalExpensesUSD;
  const grossProfitINR = netCashINR - totalExpensesINR;
  const isProfitable = grossProfitUSD >= 0;

  const expectedProfitUSD = nextMonthMRR_USD - totalExpensesUSD;
  const expectedProfitINR = nextMonthMRR_INR - totalExpensesINR;

  const goalProgress = Math.min((grossProfitINR / profitGoal) * 100, 100);
  const paidClientCount = currentMonthRecords.filter(r => r.paymentReceived > 0).length;

  const reconciliations = useMemo(() => {
    const months = getPreviousMonths(12, currentMonth, currentYear);

    const invoicedByMonth = {};
    for (const [key, records] of Object.entries(monthlyRecords)) {
      const active = records.filter(r => !r.isDeleted);
      const total = active.reduce((s, r) => s + ((r.paymentReceived || 0) + (r.upsellAmount || 0) - (r.downsellAmount || 0) - (r.refundAmount || 0) - (r.chargebackAmount || 0)), 0);
      if (total > 0) invoicedByMonth[key] = total;
    }

    const depositsByMonth = {};
    for (const d of bankDeposits) {
      const key = getMonthKey(new Date(d.date).getFullYear(), new Date(d.date).getMonth() + 1);
      depositsByMonth[key] = (depositsByMonth[key] || 0) + d.inrAmount;
    }

    return months.map(({ year, month }, idx) => {
      const key = getMonthKey(year, month);
      const label = `${MONTH_LABELS[parseInt(month)]} ${year}`;
      const invoiced = invoicedByMonth[key] || 0;
      const deposits = depositsByMonth[key] || 0;

      let impliedRate = null;
      if (invoiced > 0 && deposits > 0) {
        impliedRate = deposits / invoiced;
      }

      return { key, label, invoiced, deposits, impliedRate, idx };
    }).filter(m => m.invoiced > 0 || m.deposits > 0).reverse();
  }, [monthlyRecords, bankDeposits, currentMonth, currentYear]);

  const rollingAverages = useMemo(() => {
    const result = {};
    for (let i = 0; i < reconciliations.length; i++) {
      const month = reconciliations[i];
      const windowMonths = reconciliations.slice(i, i + 3);
      const withRate = windowMonths.filter(m => m.impliedRate !== null);
      if (withRate.length === 0) {
        result[month.key] = { value: null, count: 0 };
      } else if (withRate.length < 3) {
        result[month.key] = {
          value: withRate.reduce((s, m) => s + m.impliedRate, 0) / withRate.length,
          count: withRate.length
        };
      } else {
        result[month.key] = {
          value: withRate.reduce((s, m) => s + m.impliedRate, 0) / 3,
          count: 3
        };
      }
    }
    return result;
  }, [reconciliations]);

  return (
    <div className="pnl-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Summary</h1>
          <p className="page-subtitle">{curMonthName} {currentYear} &mdash; Invoiced vs. Bank Deposits</p>
        </div>
      </div>

      <div className="pnl-grid-new">

        {/* Invoiced Box */}
        <div className="card pnl-box">
          <div className="pnl-box-header">
            <h3>INVOICED THIS MONTH (USD)</h3>
            <span className="badge badge-success">Actual</span>
          </div>
          <div className="pnl-box-content">
            <div className="pnl-line">
              <span className="text-muted">Total Payments Received:</span>
              <span className="font-semibold">{formatUSD(totalReceived)}</span>
            </div>
            <div className="pnl-line text-sm text-muted">
              <span>({paidClientCount} clients paid)</span>
            </div>

            <div className="pnl-line mt-2">
              <span className="text-muted">Less: Refunds:</span>
              <span className="text-danger">-{formatUSD(totalRefunds)}</span>
            </div>
            <div className="pnl-line border-bottom">
              <span className="text-muted">Less: Chargebacks:</span>
              <span className="text-danger">-{formatUSD(totalChargebacks)}</span>
            </div>

            <div className="pnl-line total-line mt-3">
              <span className="font-bold text-heading">NET INVOICED ({curMonthName}):</span>
              <div className="text-right">
                <span className="font-bold text-success text-lg">{formatUSD(netCashUSD)}</span>
                <div className="text-xs text-muted">&asymp; {formatINR(netCashINR)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* MRR / Recurring Box */}
        <div className="card pnl-box">
          <div className="pnl-box-header">
            <h3>REVENUE GENERATING (RECURRING)</h3>
            <span className="badge badge-info">Forecast</span>
          </div>
          <div className="pnl-box-content">
            <div className="pnl-line">
              <span className="text-muted">Active Clients (end of {curMonthName}):</span>
              <span className="font-semibold">{currentMonthActive.length} clients</span>
            </div>
            <div className="pnl-line">
              <span className="text-muted">Next Month MRR ({nextMonthName}):</span>
              <span className="font-bold text-info text-lg">{formatUSD(nextMonthMRR_USD)}</span>
            </div>
            <div className="pnl-line text-sm text-muted border-bottom">
              <span>(What you'll earn from active clients next month)</span>
            </div>

            <div className="pnl-line mt-3">
              <span className="text-muted">Monthly Expenses (INR):</span>
              <span className="font-semibold">{formatINR(totalExpensesINR)}</span>
            </div>
            <div className="pnl-line text-sm text-muted">
              <span>(Converted to USD: {formatUSD(totalExpensesUSD)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* P&L Statement */}
      <div className="card mt-4 pnl-statement">
        <h3 className="mb-4 flex items-center gap-2"><Target size={18} /> {curMonthName} {currentYear} P&L Statement</h3>

        <div className="pnl-statement-grid">
          {/* Income Column */}
          <div>
            <h4 className="statement-section-title">INCOME</h4>
            <div className="statement-row">
              <span>Gross Revenue:</span>
              <span className="font-semibold">{formatUSD(netCashUSD)}</span>
            </div>
            <div className="statement-row total-line" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 8, marginTop: 4 }}>
              <span className="font-bold text-heading">Net Revenue:</span>
              <div className="text-right">
                <span className="font-bold text-success">{formatUSD(netCashUSD)}</span>
                <div className="text-xs text-muted">&asymp; {formatINR(netCashINR)}</div>
              </div>
            </div>
          </div>

          {/* Expenses Column */}
          <div>
            <h4 className="statement-section-title">EXPENSES</h4>
            <div className="statement-row">
              <span>Total Expenses:</span>
              <span className="font-semibold text-danger">-{formatINR(totalExpensesINR)}</span>
            </div>
            <div className="text-xs text-muted mt-1">(&asymp; {formatUSD(totalExpensesUSD)})</div>
          </div>

          {/* Profit Column */}
          <div className="profit-column">
            <h4 className="statement-section-title">PROFIT/LOSS</h4>
            <div className="statement-row text-lg">
              <span>Gross Profit ({curMonthName}):</span>
              <div className="text-right">
                <span className={`font-bold ${isProfitable ? 'text-success' : 'text-danger'}`}>
                  {isProfitable ? '+' : ''}{formatUSD(grossProfitUSD)}
                </span>
                <div className="text-xs text-muted">&asymp; {formatINR(grossProfitINR)}</div>
              </div>
            </div>
            <div className="text-xs text-muted mt-1">Calculation: {formatUSD(netCashUSD)} ({formatINR(netCashINR)}) &minus; {formatUSD(totalExpensesUSD)} ({formatINR(totalExpensesINR)})</div>

            <div className="forecast-box mt-4">
              <h5 className="font-semibold mb-2 flex items-center gap-1"><AlertCircle size={14}/> Forecast for {nextMonthName}</h5>
              <div className="text-sm">
                <div className="flex justify-between mb-1">
                  <span>Expected Income:</span>
                  <div className="text-right">
                    <span>{formatUSD(nextMonthMRR_USD)}</span>
                    <div className="text-xs text-muted">&asymp; {formatINR(nextMonthMRR_INR)}</div>
                  </div>
                </div>
                <div className="flex justify-between font-semibold" style={{ color: expectedProfitUSD >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  <span>Expected Profit:</span>
                  <div className="text-right">
                    <span>{expectedProfitUSD >= 0 ? '+' : ''}{formatUSD(expectedProfitUSD)}</span>
                    <div className="text-xs text-muted">&asymp; {formatINR(expectedProfitINR)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fee & Conversion Reconciliation */}
      <div className="card mt-4 pnl-statement">
        <h3 className="mb-4 flex items-center gap-2"><TrendingUp size={18} /> Fee & Conversion Reconciliation</h3>

        {reconciliations.length === 0 ? (
          <p className="text-sm text-muted">No invoiced months or deposit data yet. Start recording bank deposits and marking invoices as paid to see reconciliation data.</p>
        ) : (
          <div className="reconciliation-table-wrap">
            <table className="reconciliation-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Total Invoiced (USD)</th>
                  <th className="text-right">Total Bank Deposits (INR)</th>
                  <th className="text-right">Implied Effective Rate</th>
                  <th className="text-right">3-Month Rolling Avg Rate</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.map(m => {
                  const avg = rollingAverages[m.key];
                  return (
                    <tr key={m.key}>
                      <td className="font-semibold">{m.label}</td>
                      <td className="text-right">{formatUSD(m.invoiced)}</td>
                      <td className="text-right">{formatINR(m.deposits)}</td>
                      <td className="text-right">
                        {m.invoiced > 0 && m.deposits === 0 ? (
                          <span className="text-muted text-sm">Not yet withdrawn</span>
                        ) : m.impliedRate !== null ? (
                          <span className="font-semibold">₹{m.impliedRate.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted text-sm">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {avg && avg.value !== null ? (
                          avg.count < 3 ? (
                            <span className="text-muted text-sm">
                              ₹{avg.value.toFixed(2)} <span className="text-xs">(Building average: {avg.count} of 3 months)</span>
                            </span>
                          ) : (
                            <span className="font-semibold">₹{avg.value.toFixed(2)}</span>
                          )
                        ) : (
                          <span className="text-muted text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="reconciliation-disclaimer">
          Single-month figures may include carryover from the previous month due to how Payoneer pools withdrawals. Use the 3-month rolling average for an accurate trend.
        </p>
      </div>

    </div>
  );
}
