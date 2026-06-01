import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { MONTH_NAMES, PMS } from '../utils/helpers';

const PM_NAMES = [...PMS.map(p => p.name), 'Unassigned'];

function getMonthKey(month, year) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function prevMonth(month, year) {
  let m = parseInt(month) - 1;
  let y = parseInt(year);
  if (m < 1) { m = 12; y--; }
  return { month: String(m).padStart(2, '0'), year: String(y) };
}

function nextMonth(month, year) {
  let m = parseInt(month) + 1;
  let y = parseInt(year);
  if (m > 12) { m = 1; y++; }
  return { month: String(m).padStart(2, '0'), year: String(y) };
}

function generateMonthsBack(count, fromMonth, fromYear) {
  const months = [];
  let m = parseInt(fromMonth);
  let y = parseInt(fromYear);
  for (let i = 0; i < count; i++) {
    months.unshift({ month: String(m).padStart(2, '0'), year: String(y) });
    m--;
    if (m < 1) { m = 12; y--; }
  }
  return months;
}

const MONTH_LABELS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function PMRetention() {
  const { monthlyRecords, formatUSD } = useContext(AppContext);
  const now = new Date();
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayYear = String(now.getFullYear());

  const [logMonth, setLogMonth] = useState(todayMonth);
  const [logYear, setLogYear] = useState(todayYear);
  const [rangeMonths, setRangeMonths] = useState(3);
  const [pmFilter, setPmFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [tableSortBy, setTableSortBy] = useState(null);
  const [tableSortDir, setTableSortDir] = useState('asc');
  const [hoverPoint, setHoverPoint] = useState(null);

  const availableMonths = useMemo(() => {
    const keys = Object.keys(monthlyRecords).sort();
    return keys.map(k => {
      const [y, m] = k.split('-');
      return { month: m, year: y, label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}` };
    });
  }, [monthlyRecords]);

  const changeLog = useMemo(() => {
    const key = getMonthKey(logMonth, logYear);
    const currentRecords = monthlyRecords[key] || [];
    const prev = prevMonth(logMonth, logYear);
    const prevKey = getMonthKey(prev.month, prev.year);
    const prevRecords = monthlyRecords[prevKey] || [];

    const changes = [];
    const processedNames = new Set();

    for (const rec of currentRecords) {
      if (rec.isDeleted) continue;
      processedNames.add(rec.businessName);
      const prevRec = prevRecords.find(p => p.businessName === rec.businessName && !p.isDeleted);
      if (!prevRec) {
        changes.push({
          id: rec.id,
          businessName: rec.businessName,
          pm: rec.handledBy || 'Unassigned',
          prevPrice: 0,
          newPrice: rec.monthlyPrice,
          change: rec.monthlyPrice,
          type: 'New Client',
          month: logMonth,
          year: logYear
        });
        continue;
      }
      if (rec.status === 'Cancelled' && prevRec.status !== 'Cancelled') {
        changes.push({
          id: rec.id,
          businessName: rec.businessName,
          pm: rec.handledBy || 'Unassigned',
          prevPrice: prevRec.monthlyPrice,
          newPrice: rec.monthlyPrice,
          change: -rec.monthlyPrice,
          type: 'Churned'
        });
        continue;
      }
      if (rec.monthlyPrice !== prevRec.monthlyPrice) {
        const diff = rec.monthlyPrice - prevRec.monthlyPrice;
        changes.push({
          id: rec.id,
          businessName: rec.businessName,
          pm: rec.handledBy || 'Unassigned',
          prevPrice: prevRec.monthlyPrice,
          newPrice: rec.monthlyPrice,
          change: diff,
          type: diff > 0 ? 'Upsell' : 'Downgrade'
        });
      }
    }

    return changes;
  }, [monthlyRecords, logMonth, logYear]);

  const filteredChanges = useMemo(() => {
    let list = [...changeLog];
    if (pmFilter !== 'All') list = list.filter(c => c.pm === pmFilter);
    if (typeFilter !== 'All') list = list.filter(c => c.type === typeFilter);
    if (tableSortBy) {
      list.sort((a, b) => {
        let va = a[tableSortBy], vb = b[tableSortBy];
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return tableSortDir === 'asc' ? -1 : 1;
        if (va > vb) return tableSortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [changeLog, pmFilter, typeFilter, tableSortBy, tableSortDir]);

  const monthRange = useMemo(() => {
    return generateMonthsBack(rangeMonths, todayMonth, todayYear);
  }, [rangeMonths, todayMonth, todayYear]);

  const trendData = useMemo(() => {
    const entries = [];
    for (const { month, year } of monthRange) {
      const key = getMonthKey(month, year);
      const records = monthlyRecords[key] || [];
      const prev = prevMonth(month, year);
      const prevKey = getMonthKey(prev.month, prev.year);
      const prevRecords = monthlyRecords[prevKey] || [];

      for (const pm of PM_NAMES) {
        const activePrev = prevRecords.filter(r => !r.isDeleted && r.status === 'Active' && (r.handledBy || 'Unassigned') === pm);
        const activeCur = records.filter(r => !r.isDeleted && r.status === 'Active' && (r.handledBy || 'Unassigned') === pm);
        const startCount = activePrev.length;
        const retained = activeCur.filter(cur => activePrev.some(pr => pr.businessName === cur.businessName)).length;
        const retentionRate = startCount > 0 ? (retained / startCount) * 100 : 0;

        const upsells = [];
        const downgrades = [];
        const churned = [];
        for (const cur of records) {
          if (cur.isDeleted) continue;
          const prevRec = prevRecords.find(p => p.businessName === cur.businessName && !p.isDeleted);
          if (!prevRec) continue;
          if (cur.status === 'Cancelled' && prevRec.status !== 'Cancelled') {
            churned.push(cur);
          } else if (cur.monthlyPrice > prevRec.monthlyPrice) {
            upsells.push({ ...cur, diff: cur.monthlyPrice - prevRec.monthlyPrice });
          } else if (cur.monthlyPrice < prevRec.monthlyPrice) {
            downgrades.push({ ...cur, diff: prevRec.monthlyPrice - cur.monthlyPrice });
          }
        }

        entries.push({
          pm,
          month,
          year,
          label: `${MONTH_LABELS[parseInt(month)]} ${year}`,
          startCount,
          retained,
          churnedCount: churned.length,
          churnedAmount: churned.reduce((s, c) => s + c.monthlyPrice, 0),
          upsellCount: upsells.length,
          upsellAmount: upsells.reduce((s, c) => s + c.diff, 0),
          downgradeCount: downgrades.length,
          downgradeAmount: downgrades.reduce((s, c) => s + c.diff, 0),
          retentionRate
        });
      }
    }
    return entries;
  }, [monthRange, monthlyRecords]);

  const pmPerformance = useMemo(() => {
    if (monthRange.length === 0) return [];
    const latest = monthRange[monthRange.length - 1];
    const key = getMonthKey(latest.month, latest.year);
    const records = monthlyRecords[key] || [];
    const prev = prevMonth(latest.month, latest.year);
    const prevKey = getMonthKey(prev.month, prev.year);
    const prevRecords = monthlyRecords[prevKey] || [];

    const results = [];
    for (const pm of ['Pankaj', 'Vaishnavi']) {
      const handledPrev = prevRecords.filter(r => !r.isDeleted && r.status === 'Active' && (r.handledBy || 'Unassigned') === pm);
      const activeCur = records.filter(r => !r.isDeleted && r.status === 'Active' && (r.handledBy || 'Unassigned') === pm);
      const startCount = handledPrev.length;
      const retained = activeCur.filter(cur => handledPrev.some(pr => pr.businessName === cur.businessName)).length;
      const retentionRate = startCount > 0 ? (retained / startCount) * 100 : 0;

      const upsells = [];
      const downgrades = [];
      const churned = [];
      for (const cur of records) {
        if (cur.isDeleted) continue;
        const prevRec = prevRecords.find(p => p.businessName === cur.businessName && !p.isDeleted);
        if (!prevRec) continue;
        if (cur.status === 'Cancelled' && prevRec.status !== 'Cancelled') {
          churned.push(cur);
        } else if (cur.monthlyPrice > prevRec.monthlyPrice) {
          upsells.push({ ...cur, diff: cur.monthlyPrice - prevRec.monthlyPrice });
        } else if (cur.monthlyPrice < prevRec.monthlyPrice) {
          downgrades.push({ ...cur, diff: prevRec.monthlyPrice - cur.monthlyPrice });
        }
      }

      const netMRR = upsells.reduce((s, c) => s + c.diff, 0) - downgrades.reduce((s, c) => s + c.diff, 0) - churned.reduce((s, c) => s + c.monthlyPrice, 0);

      results.push({
        pm,
        startCount,
        retained,
        retentionRate,
        upsellCount: upsells.length,
        upsellAmount: upsells.reduce((s, c) => s + c.diff, 0),
        downgradeCount: downgrades.length,
        downgradeAmount: downgrades.reduce((s, c) => s + c.diff, 0),
        churnedCount: churned.length,
        churnedAmount: churned.reduce((s, c) => s + c.monthlyPrice, 0),
        netMRR
      });
    }
    return results;
  }, [monthRange, monthlyRecords]);

  const handleTableSort = (col) => {
    if (tableSortBy === col) setTableSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setTableSortBy(col); setTableSortDir('asc'); }
  };

  const typeBadge = (type) => {
    const styles = {
      'Upsell': { background: '#ecfdf5', color: '#059669', label: 'Upsell' },
      'Downgrade': { background: '#fef2f2', color: '#dc2626', label: 'Downgrade' },
      'Churned': { background: '#450a0a', color: '#fca5a5', label: 'Churned' },
      'New Client': { background: '#eff6ff', color: '#2563eb', label: 'New Client' }
    };
    const s = styles[type] || { background: '#f3f4f6', color: '#6b7280', label: type };
    return <span style={{ background: s.background, color: s.color, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{s.label}</span>;
  };

  const retentionColor = (rate) => {
    if (rate >= 80) return '#059669';
    if (rate >= 60) return '#d97706';
    return '#dc2626';
  };

  /* ── Line Chart ── */
  const chartData = useMemo(() => {
    if (monthRange.length < 2) return null;
    const months = monthRange;
    const pankajPoints = months.map(({ month, year }) => {
      const entry = trendData.find(e => e.pm === 'Pankaj' && e.month === month && e.year === year);
      return entry ? entry.retentionRate : 0;
    });
    const vaishnaviPoints = months.map(({ month, year }) => {
      const entry = trendData.find(e => e.pm === 'Vaishnavi' && e.month === month && e.year === year);
      return entry ? entry.retentionRate : 0;
    });

    return { months, pankajPoints, vaishnaviPoints, labels: months.map(({ month, year }) => `${MONTH_LABELS[parseInt(month)].slice(0, 3)} ${year.slice(2)}`) };
  }, [monthRange, trendData]);

  const formatSigned = (val) => {
    if (val > 0) return `+${formatUSD(val)}`;
    if (val < 0) return `-${formatUSD(Math.abs(val))}`;
    return formatUSD(0);
  };

  return (
    <div className="clients-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">PM Retention</h1>
          <p className="page-subtitle">Track project manager performance, client retention, and revenue changes.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="config-bar" style={{ flexWrap: 'wrap', gap: 12, padding: '12px 16px' }}>
        <div className="config-bar__item">
          <span className="config-bar__label">Month Range:</span>
          <select className="config-bar__input" value={rangeMonths} onChange={e => setRangeMonths(parseInt(e.target.value))}>
            <option value={1}>1 month</option>
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>
        <div className="config-bar__divider" />
        <div className="config-bar__item">
          <span className="config-bar__label">PM:</span>
          <select className="config-bar__input" value={pmFilter} onChange={e => setPmFilter(e.target.value)}>
            <option value="All">All</option>
            <option value="Pankaj">Pankaj</option>
            <option value="Vaishnavi">Vaishnavi</option>
            <option value="Unassigned">Unassigned</option>
          </select>
        </div>
        <div className="config-bar__divider" />
        <div className="config-bar__item">
          <span className="config-bar__label">Type:</span>
          <select className="config-bar__input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="All">All</option>
            <option value="Upsell">Upsells only</option>
            <option value="Downgrade">Downgrades only</option>
            <option value="Churned">Churned only</option>
          </select>
        </div>
      </div>

      {/* Monthly Change Log Table */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
          <h3 className="font-semibold text-heading" style={{ fontSize: 16, margin: 0 }}>Monthly Change Log</h3>
          <select className="input-field" style={{ width: 200 }} value={getMonthKey(logMonth, logYear)} onChange={e => { const [y, m] = e.target.value.split('-'); setLogYear(y); setLogMonth(m); }}>
            {availableMonths.map(am => (
              <option key={`${am.year}-${am.month}`} value={`${am.year}-${am.month}`}>{am.label}</option>
            ))}
          </select>
        </div>

        {filteredChanges.length === 0 ? (
          <p className="text-muted text-sm">No changes recorded for this month.</p>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => handleTableSort('businessName')} style={{ cursor: 'pointer' }}>Client Name</th>
                  <th onClick={() => handleTableSort('pm')} style={{ cursor: 'pointer' }}>PM Name</th>
                  <th onClick={() => handleTableSort('prevPrice')} style={{ cursor: 'pointer' }}>Previous Price</th>
                  <th onClick={() => handleTableSort('newPrice')} style={{ cursor: 'pointer' }}>New Price</th>
                  <th onClick={() => handleTableSort('change')} style={{ cursor: 'pointer' }}>Change Amount</th>
                  <th onClick={() => handleTableSort('type')} style={{ cursor: 'pointer' }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredChanges.map(c => (
                  <tr key={c.id}>
                    <td><span className="font-medium">{c.businessName}</span></td>
                    <td>{c.pm}</td>
                    <td>{c.prevPrice > 0 ? formatUSD(c.prevPrice) : '—'}</td>
                    <td>{formatUSD(c.newPrice)}</td>
                    <td style={{ color: c.change > 0 ? '#059669' : c.change < 0 ? '#dc2626' : 'inherit', fontWeight: 600 }}>
                      {c.change > 0 ? '+' : ''}{formatUSD(c.change)}
                    </td>
                    <td>{typeBadge(c.type)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PM Performance Dashboard */}
      <h3 className="font-semibold text-heading" style={{ fontSize: 16, margin: '16px 0 12px' }}>PM Performance Dashboard</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, marginBottom: 24 }}>
        {pmPerformance.map(p => (
          <div key={p.pm} className="card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 18, color: 'var(--text-heading)' }}>{p.pm}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
              <span className="text-muted">Clients Handled:</span><span className="font-semibold">{p.startCount}</span>
              <span className="text-muted">Clients Retained:</span><span className="font-semibold">{p.retained}</span>
              <span className="text-muted">Retention Rate:</span>
              <span className="font-semibold" style={{ color: retentionColor(p.retentionRate) }}>
                {p.startCount > 0 ? p.retentionRate.toFixed(1) : '—'}%
              </span>
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', margin: '6px 0' }} />
              <span className="text-muted">Upsells:</span>
              <span className="font-semibold" style={{ color: '#059669' }}>
                {p.upsellCount} &nbsp;{formatSigned(p.upsellAmount)}
              </span>
              <span className="text-muted">Downgrades:</span>
              <span className="font-semibold" style={{ color: '#dc2626' }}>
                {p.downgradeCount} &nbsp;-{formatUSD(p.downgradeAmount)}
              </span>
              <span className="text-muted">Churned:</span>
              <span className="font-semibold" style={{ color: '#7f1d1d' }}>
                {p.churnedCount} &nbsp;-{formatUSD(p.churnedAmount)}
              </span>
              <div style={{ gridColumn: '1 / -1', borderTop: '2px solid var(--border-light)', margin: '8px 0' }} />
              <span className="font-semibold text-heading">Net MRR Impact:</span>
              <span className="font-bold text-lg" style={{ color: p.netMRR >= 0 ? '#059669' : '#dc2626' }}>
                {formatSigned(p.netMRR)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 12 Month Trend Chart */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-semibold text-heading" style={{ fontSize: 16, margin: '0 0 16px' }}>12 Month Retention Rate Trend</h3>
        {chartData && chartData.months.length >= 2 ? (
          <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
            <svg
              viewBox="0 0 800 300"
              style={{ width: '100%', minWidth: 500, height: 300 }}
              onMouseMove={e => {
                const rect = e.target.closest('svg').getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width * 800;
                const totalMonths = chartData.months.length;
                const spacing = 700 / (totalMonths - 1 || 1);
                const idx = Math.round((x - 50) / spacing);
                const clamped = Math.max(0, Math.min(totalMonths - 1, idx));
                const monthData = chartData.months[clamped];
                const pankajE = trendData.find(e => e.pm === 'Pankaj' && e.month === monthData.month && e.year === monthData.year);
                const vaishnaviE = trendData.find(e => e.pm === 'Vaishnavi' && e.month === monthData.month && e.year === monthData.year);
                setHoverPoint({
                  idx: clamped,
                  label: chartData.labels[clamped],
                  pankaj: pankajE || null,
                  vaishnavi: vaishnaviE || null
                });
              }}
              onMouseLeave={() => setHoverPoint(null)}
            >
              {/* Grid lines */}
              {[0, 20, 40, 60, 80, 100].map(v => {
                const y = 250 - v * 2;
                return (
                  <g key={v}>
                    <line x1={50} y1={y} x2={750} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                    <text x={45} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{v}%</text>
                  </g>
                );
              })}

              {/* X axis labels */}
              {chartData.labels.map((l, i) => {
                const spacing = 700 / (chartData.months.length - 1 || 1);
                const x = 50 + i * spacing;
                return (
                  <text key={i} x={x} y={275} textAnchor="middle" fontSize={10} fill="#9ca3af" transform={`rotate(-30, ${x}, 275)`}>
                    {l}
                  </text>
                );
              })}

              {/* Pankaj line */}
              {(() => {
                const spacing = 700 / (chartData.pankajPoints.length - 1 || 1);
                const points = chartData.pankajPoints.map((v, i) => `${50 + i * spacing},${250 - v * 2}`);
                if (points.length < 2) return null;
                const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ');
                return (
                  <g>
                    <path d={d} fill="none" stroke="#6366f1" strokeWidth={2.5} />
                    {chartData.pankajPoints.map((v, i) => {
                      const x = 50 + i * spacing;
                      const y = 250 - v * 2;
                      return <circle key={i} cx={x} cy={y} r={3} fill="#6366f1" />;
                    })}
                  </g>
                );
              })()}

              {/* Vaishnavi line */}
              {(() => {
                const spacing = 700 / (chartData.vaishnaviPoints.length - 1 || 1);
                const points = chartData.vaishnaviPoints.map((v, i) => `${50 + i * spacing},${250 - v * 2}`);
                if (points.length < 2) return null;
                const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ');
                return (
                  <g>
                    <path d={d} fill="none" stroke="#a855f7" strokeWidth={2.5} />
                    {chartData.vaishnaviPoints.map((v, i) => {
                      const x = 50 + i * spacing;
                      const y = 250 - v * 2;
                      return <circle key={i} cx={x} cy={y} r={3} fill="#a855f7" />;
                    })}
                  </g>
                );
              })()}

              {/* Legend */}
              <rect x={580} y={10} width={160} height={50} rx={6} fill="white" stroke="#e5e7eb" strokeWidth={1} />
              <circle cx={592} cy={26} r={5} fill="#6366f1" />
              <text x={602} y={30} fontSize={12} fill="#374151">Pankaj</text>
              <circle cx={592} cy={44} r={5} fill="#a855f7" />
              <text x={602} y={48} fontSize={12} fill="#374151">Vaishnavi</text>
            </svg>

            {/* Tooltip */}
            {hoverPoint && (
              <div style={{
                position: 'absolute',
                top: 8,
                left: 12,
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 10,
                minWidth: 200
              }}>
                <div className="font-semibold mb-1">{hoverPoint.label}</div>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                  <span>Pankaj: {hoverPoint.pankaj ? `${hoverPoint.pankaj.retentionRate.toFixed(1)}%` : 'N/A'}</span>
                </div>
                {hoverPoint.pankaj && (
                  <div className="text-xs text-muted" style={{ marginLeft: 16 }}>
                    ↑{hoverPoint.pankaj.upsellCount} ↓{hoverPoint.pankaj.downgradeCount} ✕{hoverPoint.pankaj.churnedCount}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
                  <span>Vaishnavi: {hoverPoint.vaishnavi ? `${hoverPoint.vaishnavi.retentionRate.toFixed(1)}%` : 'N/A'}</span>
                </div>
                {hoverPoint.vaishnavi && (
                  <div className="text-xs text-muted" style={{ marginLeft: 16 }}>
                    ↑{hoverPoint.vaishnavi.upsellCount} ↓{hoverPoint.vaishnavi.downgradeCount} ✕{hoverPoint.vaishnavi.churnedCount}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted text-sm">Select a range of at least 2 months to view the trend chart.</p>
        )}
      </div>
    </div>
  );
}
