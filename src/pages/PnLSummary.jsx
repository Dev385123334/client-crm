import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { EXPENSE_CATEGORIES } from '../utils/helpers';
import { TrendingUp, TrendingDown, Target, AlertCircle } from 'lucide-react';
import './PnLSummary.css';

export default function PnLSummary() {
  const {
    currentMonthRecords, currentMonthActive,
    expenses, currentMonth, currentYear,
    exchangeRate, convertToINR, formatUSD, formatINR, profitGoal
  } = useContext(AppContext);

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const curMonthName = monthNames[parseInt(currentMonth)];

  let nextMonthNum = parseInt(currentMonth) + 1;
  let nextYearNum = parseInt(currentYear);
  if (nextMonthNum > 12) { nextMonthNum = 1; nextYearNum++; }
  const nextMonthName = monthNames[nextMonthNum];

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

  const goalProgress = Math.min((grossProfitINR / profitGoal) * 100, 100);
  const paidClientCount = currentMonthRecords.filter(r => r.paymentReceived > 0).length;

  return (
    <div className="pnl-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Summary</h1>
          <p className="page-subtitle">{curMonthName} {currentYear} &mdash; Cash Received vs. MRR</p>
        </div>
      </div>

      <div className="pnl-grid-new">

        {/* Cash In Box */}
        <div className="card pnl-box">
          <div className="pnl-box-header">
            <h3>CASH RECEIVED THIS MONTH</h3>
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
              <span className="font-bold text-heading">NET CASH IN ({curMonthName}):</span>
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
              <span>Net Cash In ({curMonthName}):</span>
              <span className="font-semibold text-success">{formatUSD(netCashUSD)}</span>
            </div>
            <div className="statement-row mt-4">
              <span className="text-muted">Active Clients Revenue:</span>
              <span className="text-muted">{formatUSD(totalReceived)}</span>
            </div>
            <div className="statement-row">
              <span className="text-muted">Next Month MRR:</span>
              <span className="text-muted">{formatUSD(nextMonthMRR_USD)}</span>
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
              <span className={`font-bold ${isProfitable ? 'text-success' : 'text-danger'}`}>
                {isProfitable ? '+' : ''}{formatUSD(grossProfitUSD)}
              </span>
            </div>
            <div className="text-xs text-muted mt-1">Calculation: {formatUSD(netCashUSD)} - {formatUSD(totalExpensesUSD)}</div>

            <div className="forecast-box mt-4">
              <h5 className="font-semibold mb-2 flex items-center gap-1"><AlertCircle size={14}/> Forecast for {nextMonthName}</h5>
              <div className="text-sm">
                <div className="flex justify-between mb-1">
                  <span>Expected Income:</span>
                  <span>{formatUSD(nextMonthMRR_USD)}</span>
                </div>
                <div className="flex justify-between font-semibold" style={{ color: expectedProfitUSD >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  <span>Expected Profit:</span>
                  <span>{expectedProfitUSD >= 0 ? '+' : ''}{formatUSD(expectedProfitUSD)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
