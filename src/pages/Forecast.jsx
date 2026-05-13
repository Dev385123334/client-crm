import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { calculateTenure } from '../utils/helpers';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Zap, Target } from 'lucide-react';
import './Forecast.css';

export default function Forecast() {
  const { currentMonthActive, expenses, currentMonth, currentYear, exchangeRate, convertToINR, formatUSD, formatINR, profitGoal } = useContext(AppContext);

  const [churnSlider, setChurnSlider] = useState(10);

  const activeClients = currentMonthActive;
  const totalMRR = activeClients.reduce((s, r) => s + r.monthlyPrice, 0);
  const avgClientValue = activeClients.length > 0 ? totalMRR / activeClients.length : 0;

  const monthExpenses = expenses.filter(e => e.month === currentMonth && e.year === currentYear);
  const totalExpenses_INR = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExpenses_USD = totalExpenses_INR / exchangeRate;
  const projectedARR = totalMRR * 12;

  const scenarios = useMemo(() => {
    const months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startMonthIdx = parseInt(currentMonth) - 1;
    for (let i = 0; i < 12; i++) {
      const mIdx = (startMonthIdx + i) % 12;
      months.push({
        month: monthNames[mIdx],
        Pessimistic: Math.round(totalMRR * Math.pow(1 - 0.20, i)),
        Realistic: Math.round(totalMRR * Math.pow(1 - 0.10, i)),
        Optimistic: Math.round(totalMRR * Math.pow(1 - 0.05, i)),
        Growth: Math.round(totalMRR + (avgClientValue * 2 * i)),
        Custom: Math.round(totalMRR * Math.pow(1 - churnSlider / 100, i))
      });
    }
    return months;
  }, [totalMRR, avgClientValue, currentMonth, churnSlider]);

  const clientsToBreakEven = avgClientValue > 0 ? Math.ceil(totalExpenses_USD / avgClientValue) : 0;
  const profitBuffer = activeClients.length - clientsToBreakEven;
  const maxChurnBeforeLoss = activeClients.length > 0 ? ((profitBuffer / activeClients.length) * 100).toFixed(1) : 0;

  const revenueNeeded_INR = profitGoal + totalExpenses_INR;
  const revenueNeeded_USD = revenueNeeded_INR / exchangeRate;
  const clientsNeeded = avgClientValue > 0 ? Math.ceil(revenueNeeded_USD / avgClientValue) : 0;
  const gap = clientsNeeded - activeClients.length;
  const monthsAt2 = gap > 0 ? Math.ceil(gap / 2) : 0;
  const monthsAt3 = gap > 0 ? Math.ceil(gap / 3) : 0;

  const contributions = activeClients.map(c => ({ ...c, pctMRR: totalMRR > 0 ? ((c.monthlyPrice / totalMRR) * 100) : 0, tenure: calculateTenure(c.onboardingDate, currentMonth, currentYear) })).sort((a, b) => b.monthlyPrice - a.monthlyPrice);
  const top3Revenue = contributions.slice(0, 3).reduce((s, c) => s + c.pctMRR, 0);

  const insights = [];
  insights.push(`Your top 3 clients generate ${top3Revenue.toFixed(1)}% of revenue. Consider risk mitigation.`);
  if (profitBuffer > 0) insights.push(`You're profitable with a ${profitBuffer}-client safety buffer above break-even.`);
  if (gap > 0) insights.push(`To reach \u20B92L profit goal, add ${gap} more clients or increase prices by ${avgClientValue > 0 ? (((revenueNeeded_USD - totalMRR) / totalMRR) * 100).toFixed(0) : 0}%.`);
  insights.push(`At 10% churn, you'll lose ${formatUSD(totalMRR * 0.10)}/month \u2014 ${Math.round(activeClients.length * 0.10)} clients \u2014 within 12 months.`);
  if (contributions[0]) insights.push(`Your oldest client has been with you ${contributions[contributions.length - 1]?.tenure?.text || '?'} \u2014 consider a renewal conversation.`);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div className="chart-tooltip">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((p, i) => <p key={i} style={{ color: p.color, fontSize: 12, margin: '2px 0' }}>{p.name}: {formatUSD(p.value)}</p>)}
      </div>
    );
  };

  return (
    <div className="forecast-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue Forecast</h1>
          <p className="page-subtitle">Project growth, model churn scenarios, and plan for your target</p>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card stat-card"><div className="stat-label">Current MRR</div><div className="stat-value">{formatUSD(totalMRR)}</div><div className="stat-sub">{formatINR(convertToINR(totalMRR))}</div></div>
        <div className="card stat-card"><div className="stat-label">Projected ARR (100% retention)</div><div className="stat-value">{formatUSD(projectedARR)}</div><div className="stat-sub">{formatINR(convertToINR(projectedARR))}</div></div>
      </div>

      <div className="card">
        <h3 className="section-title">\uD83D\uDCCA 12-Month Churn Scenario Modeling</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={scenarios} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, marginTop: 10 }} />
            <Line type="monotone" dataKey="Pessimistic" stroke="var(--danger)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Realistic" stroke="var(--warning)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Optimistic" stroke="var(--success)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Growth" stroke="var(--accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="section-title">\uD83C\uDF9A\uFE0F Interactive Churn Slider</h3>
        <div style={{ maxWidth: 500, marginBottom: 20 }}>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Monthly Churn Rate</span>
            <span className="font-bold text-accent">{churnSlider}%</span>
          </div>
          <input type="range" min="0" max="50" step="5" value={churnSlider} onChange={e => setChurnSlider(parseInt(e.target.value))} className="slider" />
          <div className="flex justify-between text-xs text-muted mt-1"><span>0%</span><span>25%</span><span>50%</span></div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={scenarios} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
            <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="Custom" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-sm text-body mt-4">At {churnSlider}% monthly churn, MRR drops from {formatUSD(totalMRR)} to <strong style={{ color: 'var(--text-heading)' }}>{formatUSD(scenarios[11]?.Custom || 0)}</strong> in 12 months.</p>
      </div>

      <div className="pnl-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card pnl-section">
          <h3 className="pnl-section-title"><AlertTriangle size={16} /> Break-Even Analysis</h3>
          <div className="pnl-rows">
            <div className="pnl-row"><span>Monthly Costs</span><span className="font-semibold">{formatINR(totalExpenses_INR)}</span></div>
            <div className="pnl-row"><span>Monthly Cost (USD)</span><span className="font-semibold">{formatUSD(totalExpenses_USD)}</span></div>
            <div className="pnl-row"><span>Clients to Break-Even</span><span className="font-semibold">{clientsToBreakEven}</span></div>
            <div className="pnl-row"><span>Current Clients</span><span className="font-semibold">{activeClients.length}</span></div>
            <div className="pnl-row"><span>Profit Buffer</span><span className={`font-semibold ${profitBuffer > 0 ? 'text-success' : 'text-danger'}`}>{profitBuffer} clients</span></div>
            <div className="pnl-row"><span>Max Churn Before Loss</span><span className="font-semibold">{maxChurnBeforeLoss}%</span></div>
          </div>
        </div>

        <div className="card pnl-section">
          <h3 className="pnl-section-title"><Target size={16} /> Growth Metrics</h3>
          <div className="pnl-rows">
            <div className="pnl-row"><span>Current MRR</span><span className="font-semibold">{formatUSD(totalMRR)}</span></div>
            <div className="pnl-row"><span>Profit Goal</span><span className="font-semibold">{formatINR(profitGoal)}/mo</span></div>
            <div className="pnl-row"><span>Revenue Needed</span><span className="font-semibold">{formatINR(revenueNeeded_INR)}</span></div>
            <div className="pnl-row"><span>Clients Needed</span><span className="font-semibold">{clientsNeeded}</span></div>
            <div className="pnl-row"><span>Gap</span><span className={`font-semibold ${gap > 0 ? 'text-warning' : 'text-success'}`}>{gap > 0 ? `+${gap} needed` : 'Goal met!'}</span></div>
            <div className="pnl-row"><span>At +2 clients/mo</span><span className="font-semibold">{monthsAt2} months</span></div>
            <div className="pnl-row"><span>At +3 clients/mo</span><span className="font-semibold">{monthsAt3} months</span></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 10px 20px' }}><h3 className="section-title m-0">\uD83D\uDCCB Client Contribution Table</h3></div>
        <table className="table">
          <thead><tr><th>#</th><th>Business Name</th><th>Monthly Price</th><th>% of MRR</th><th>Tenure</th><th>Status</th></tr></thead>
          <tbody>
            {contributions.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td className="font-medium">{c.businessName} {c.pctMRR > 10 && <span className="badge badge-warning" style={{ marginLeft: 8 }}>⚠ High Dependency</span>}</td>
                <td className="font-semibold">{formatUSD(c.monthlyPrice)}</td>
                <td><div className="flex items-center gap-2"><div className="progress-track" style={{ width: 80, height: 6 }}><div className="progress-fill" style={{ width: `${c.pctMRR}%`, background: 'var(--accent)' }}></div></div><span className="text-xs">{c.pctMRR.toFixed(1)}%</span></div></td>
                <td className="text-muted">{c.tenure.text}</td>
                <td><span className="badge badge-success">{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
        <h3 className="section-title"><Zap size={16} style={{ color: 'var(--warning)' }} /> Actionable Insights</h3>
        <div className="flex flex-col gap-3 mt-4">
          {insights.map((text, i) => (
            <div key={i} className="flex gap-2 text-sm text-body">
              <span>💡</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
