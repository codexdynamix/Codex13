import React, { useContext, useMemo } from 'react';
import { DataContext } from '../../shared';

const fmt = (n) => (n == null ? '0' : Number(n).toLocaleString());

const STATUS_COLORS = {
  Deposit: '#30D158',
  'Failed Deposit': '#FF6464',
  New: '#0A84FF',
  'In Line': '#64D2FF',
  'No Answer': '#FFB020',
  'Call Back': '#BF5AF2',
  'Not Interested': '#8E8E93',
  'Low Potential': '#7B8392',
  'No Potential': '#5A6068',
  'Wrong Number': '#5A6068',
  'Wrong Person': '#5A6068',
  "Didn't Register": '#5A6068',
  NA1: 'var(--crm-text-secondary)',
  NA2: 'var(--crm-text-secondary)',
  NA3: 'var(--crm-text-secondary)',
  'Never Answer': 'var(--crm-text-secondary)',
};
const colorFor = (status) => STATUS_COLORS[status] || 'var(--crm-accent)';

const KpiCard = ({ label, value, sub, accent = 'var(--crm-accent)', icon }) => (
  <div className="crm-dashboard-card" style={{ position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: accent, opacity: 0.85 }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: '#8B94A3', fontWeight: 500, letterSpacing: 0.2 }}>{label}</div>
      <div style={{ width: 26, height: 26, borderRadius: 7, background: `${accent}1F`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{icon}</div>
    </div>
    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--crm-text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: '#7B8392', marginTop: 4 }}>{sub}</div>}
  </div>
);

const DonutChart = ({ data, size = 180, thickness = 26 }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#2B3139" strokeWidth={thickness} />
      {data.map((d, i) => {
        const frac = d.value / total;
        const dash = frac * circumference;
        const gap = circumference - dash;
        const seg = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return seg;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--crm-text-primary)">{fmt(total)}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="#8B94A3">Leads</text>
    </svg>
  );
};

const HBar = ({ label, value, max, color = 'var(--crm-accent)', valueLabel }) => {
  const pct = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#C8CDD6', marginBottom: 5 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ color: '#8B94A3', fontVariantNumeric: 'tabular-nums' }}>{valueLabel ?? fmt(value)}</span>
      </div>
      <div style={{ height: 8, background: '#2B3139', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}AA, ${color})`, borderRadius: 4, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
};

const Sparkline = ({ points, width = 600, height = 120, color = 'var(--crm-accent)', label }) => {
  if (!points.length) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = width / Math.max(points.length - 1, 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - 16 - (p.value / max) * (height - 36);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `${path} L ${(points.length - 1) * stepX} ${height - 16} L 0 ${height - 16} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={width} y1={(height - 16) * g + 4} y2={(height - 16) * g + 4} stroke="#2B3139" strokeDasharray="3 4" />
      ))}
      <path d={area} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {points.map((p, i) => {
        const x = i * stepX;
        const y = height - 16 - (p.value / max) * (height - 36);
        return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
      })}
      {points.map((p, i) =>
        i % Math.ceil(points.length / 7) === 0 || i === points.length - 1 ? (
          <text key={`l${i}`} x={i * stepX} y={height - 2} fontSize="9" fill="#7B8392" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
            {p.label}
          </text>
        ) : null,
      )}
      {label && <text x="6" y="12" fontSize="10" fill="#8B94A3">{label}</text>}
    </svg>
  );
};

const Dashboard = ({ offices = [], teams = [], staffUsers = [] }) => {
  const { leads = [], activityLog = [] } = useContext(DataContext) || {};

  const stats = useMemo(() => {
    const total = leads.length;
    const online = leads.filter((l) => l.isOnline).length;

    const agents = staffUsers.filter((u) => u.role === 'Agent').length;
    const teamLeaders = staffUsers.filter((u) => u.role === 'Team Leader').length;
    const officeManagers = staffUsers.filter((u) => u.role === 'Office Manager').length;

    return {
      total,
      online,
      agents,
      teamLeaders,
      officeManagers,
    };
  }, [leads, staffUsers]);

  const statusBreakdown = useMemo(() => {
    const counts = {};
    leads.forEach((l) => {
      const s = l.stage || l.leadStatus || 'New';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: colorFor(name) }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  const officePerformance = useMemo(() => {
    return offices.map((o) => {
      const officeLeads = leads.filter((l) => (l.assignedToOffice || l.officeId) === o.id);
      const converted = officeLeads.filter((l) => (l.stage || l.leadStatus) === 'Deposit').length;
      return {
        id: o.id,
        name: o.name,
        leads: officeLeads.length,
        converted,
        conv: officeLeads.length ? ((converted / officeLeads.length) * 100).toFixed(1) : '0.0',
      };
    }).sort((a, b) => b.leads - a.leads);
  }, [offices, leads]);

  const topTeams = useMemo(() => {
    return teams.map((t) => {
      const tLeads = leads.filter((l) => (l.assignedToTeam || l.teamId) === t.id);
      const converted = tLeads.filter((l) => (l.stage || l.leadStatus) === 'Deposit').length;
      const office = offices.find((o) => o.id === t.officeId);
      return { id: t.id, name: t.name, office: office?.name || '-', leads: tLeads.length, converted };
    }).sort((a, b) => b.converted - a.converted || b.leads - a.leads).slice(0, 6);
  }, [teams, leads, offices]);

  const trend = useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, value: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    leads.forEach((l) => {
      const k = (l.registeredDate || '').slice(0, 10);
      if (map.has(k)) map.get(k).value += 1;
    });
    return buckets;
  }, [leads]);

  const recentActivity = useMemo(() => (activityLog || []).slice(0, 8), [activityLog]);
  const onlineLeads = useMemo(() => leads.filter((l) => l.isOnline).slice(0, 8), [leads]);

  const maxOfficeLeads = officePerformance.length ? officePerformance[0].leads : 0;

  return (
    <div id="analytics-section" className="crm-admin-section">
      <h2>[chart] Analytics Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 crm-mb-6">
        <KpiCard label="Total Leads" value={fmt(stats.total)} sub={`${fmt(stats.online)} online now`} accent="var(--crm-accent)" icon="[users]" />
        <KpiCard label="Offices" value={fmt(offices.length)} sub={`${fmt(stats.officeManagers)} managers`} accent="#BF5AF2" icon="[office]" />
        <KpiCard label="Teams" value={fmt(teams.length)} sub={`${fmt(stats.teamLeaders)} leaders`} accent="#64D2FF" icon="[users]" />
        <KpiCard label="Agents" value={fmt(stats.agents)} sub="Across all teams" accent="#FFB020" icon="[agent]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 crm-mb-6">
        <div className="crm-dashboard-card">
          <h3 style={{ marginTop: 0 }}>[status] Lead Status Distribution</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <DonutChart data={statusBreakdown.length ? statusBreakdown : [{ name: 'No data', value: 1, color: '#2B3139' }]} />
            <div style={{ flex: 1, minWidth: 140, maxHeight: 200, overflowY: 'auto' }}>
              {statusBreakdown.slice(0, 8).map((s) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#C8CDD6', marginBottom: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ color: '#8B94A3', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="crm-dashboard-card lg:col-span-2">
          <h3 style={{ marginTop: 0 }}>[office] Office Performance</h3>
          <div style={{ marginTop: 8 }}>
            {officePerformance.length === 0 && <div style={{ color: '#8B94A3', fontSize: 12 }}>No offices yet.</div>}
            {officePerformance.map((o) => (
              <HBar
                key={o.id}
                label={o.name}
                value={o.leads}
                max={maxOfficeLeads}
                color="var(--crm-accent)"
                valueLabel={`${fmt(o.leads)} leads  /  ${fmt(o.converted)} converted  /  ${o.conv}%`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="crm-dashboard-card crm-mb-6">
        <h3 style={{ marginTop: 0 }}>[trend] New Leads - Last 14 Days</h3>
        <Sparkline points={trend} color="var(--crm-accent)" label="Daily registrations" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 crm-mb-6">
        <div className="crm-dashboard-card lg:col-span-2">
          <h3 style={{ marginTop: 0 }}>[top] Top Performing Teams</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: '#8B94A3', textAlign: 'left' }}>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid #2B3139', fontWeight: 500 }}>Team</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid #2B3139', fontWeight: 500 }}>Office</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid #2B3139', fontWeight: 500, textAlign: 'right' }}>Leads</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid #2B3139', fontWeight: 500, textAlign: 'right' }}>Converted</th>
                  <th style={{ padding: '8px 6px', borderBottom: '1px solid #2B3139', fontWeight: 500, textAlign: 'right' }}>Conv.</th>
                </tr>
              </thead>
              <tbody>
                {topTeams.map((t) => (
                  <tr key={t.id}>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #1E2026', color: 'var(--crm-text-primary)' }}>{t.name}</td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #1E2026', color: '#C8CDD6' }}>{t.office}</td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #1E2026', color: 'var(--crm-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(t.leads)}</td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #1E2026', color: '#30D158', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(t.converted)}</td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #1E2026', color: 'var(--crm-accent)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.leads ? `${((t.converted / t.leads) * 100).toFixed(1)}%` : '-'}</td>
                  </tr>
                ))}
                {topTeams.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '14px 6px', color: '#8B94A3', textAlign: 'center' }}>No teams yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="crm-dashboard-card">
          <h3 style={{ marginTop: 0 }}>[users] Online Leads</h3>
          <div className="crm-activity-feed">
            {onlineLeads.length === 0 && (
              <div style={{ color: '#8B94A3', fontSize: 12, padding: '8px 0' }}>No leads currently online.</div>
            )}
            {onlineLeads.map((lead) => (
              <div className="crm-activity-item" key={lead.id}>
                <div className="crm-activity-icon crm-login" style={{ position: 'relative' }}>
                  <img src={`https://placehold.co/40x40/1e1e26/f0f0f5?text=${(lead.name || '?').charAt(0)}`} className="rounded-full w-8 h-8" alt="" />
                  <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px', background: '#30D158', borderRadius: '50%', border: '2px solid #1E2026' }}></div>
                </div>
                <div className="crm-activity-details">
                  <p className="crm-activity-message font-semibold">{lead.name}</p>
                  <p className="crm-activity-timestamp">{lead.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="crm-dashboard-card">
        <h3 style={{ marginTop: 0 }}>[list] Recent Activity</h3>
        <div className="crm-activity-feed">
          {recentActivity.length === 0 && (
            <div style={{ color: '#8B94A3', fontSize: 12, padding: '8px 0' }}>No recent activity recorded.</div>
          )}
          {recentActivity.map((item, index) => {
            const lead = leads.find((l) => l.id === item.userId);
            const iconCls =
              item.type === 'login' ? 'fa-sign-in-alt'
              : item.type === 'failed-login' ? 'fa-exclamation-triangle'
              : item.type === 'password-change' ? 'fa-key'
              : 'fa-circle';
            const ts = item.timestamp ? new Date(item.timestamp) : null;
            return (
              <div className="crm-activity-item" key={index}>
                <div className={`crm-activity-icon ${item.type || ''}`}><i className={`fas ${iconCls}`}></i></div>
                <div className="crm-activity-details">
                  <p className="crm-activity-message"><b>{lead ? lead.name : 'Unknown'}</b> {item.details}</p>
                  <p className="crm-activity-timestamp">{ts ? ts.toLocaleString() : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
