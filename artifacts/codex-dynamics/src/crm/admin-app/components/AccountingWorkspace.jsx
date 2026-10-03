import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, CreditCard, FileText, Layers3, RefreshCw, Search, X } from 'lucide-react';
import { getAdminAccountingOverview } from '../adminApi.js';
import ClientAccountingPanel from './ClientAccountingPanel.jsx';
import './accounting-workspace.css';

const emptyOverview = { clients: [], invoices: [], payments: [], recurringServices: [], hosting: [], domains: [] };
const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const asArray = (value) => Array.isArray(value) ? value : [];
const normalizeOverview = (payload) => ({
  clients: asArray(payload?.clients),
  invoices: asArray(payload?.invoices).map((row) => ({
    ...row, subtotal: asNumber(row.subtotal), tax: asNumber(row.tax), total: asNumber(row.total),
    amount_paid: asNumber(row.amount_paid), balance_due: asNumber(row.balance_due),
  })),
  payments: asArray(payload?.payments).map((row) => ({ ...row, amount: asNumber(row.amount) })),
  recurringServices: asArray(payload?.recurringServices).map((row) => ({ ...row, amount: asNumber(row.amount) })),
  hosting: asArray(payload?.hosting).map((row) => ({ ...row, amount: asNumber(row.amount) })),
  domains: asArray(payload?.domains),
});
const currencyLabel = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
  }
};
const dateLabel = (value, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not set' : new Intl.DateTimeFormat(undefined, options).format(date);
};
const monthKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 7) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const normalizeStatus = (value) => String(value || 'Unspecified').trim();
const statusTone = (value) => {
  const status = String(value || '').toLowerCase();
  if (['paid', 'active', 'received', 'complete', 'completed'].includes(status)) return 'positive';
  if (['overdue', 'failed', 'cancelled', 'inactive', 'expired'].includes(status)) return 'negative';
  if (['draft', 'pending', 'scheduled', 'upcoming', 'partially paid'].includes(status)) return 'caution';
  return 'neutral';
};

function CurrencyAmounts({ rows, amountKey, className = '' }) {
  const totals = useMemo(() => {
    const grouped = new Map();
    rows.forEach((row) => {
      const currency = row.currency || 'USD';
      grouped.set(currency, (grouped.get(currency) || 0) + asNumber(row[amountKey]));
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, amountKey]);
  if (!totals.length) return <span className={`aw-no-value ${className}`}>No activity</span>;
  return <span className={`aw-currency-stack ${className}`} data-testid={`text-currency-total-${amountKey}`}>
    {totals.map(([currency, value]) => <span key={currency} className="aw-money" data-testid={`text-total-${amountKey}-${currency}`}>
      {currencyLabel(value, currency)} <small>{currency}</small>
    </span>)}
  </span>;
}

function Metric({ label, icon: Icon, rows, amountKey, detail, variant }) {
  return <article className={`aw-metric aw-metric-${variant}`} data-testid={`card-metric-${variant}`}>
    <div className="aw-metric-top"><span>{label}</span><Icon size={16} aria-hidden="true" /></div>
    <CurrencyAmounts rows={rows} amountKey={amountKey} />
    <p>{detail}</p>
  </article>;
}

function StatusBadge({ value, testId }) {
  return <span className={`aw-status aw-status-${statusTone(value)}`} data-testid={testId || `status-accounting-${String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
    <span className="aw-status-dot" aria-hidden="true" />{normalizeStatus(value)}
  </span>;
}

export default function AccountingWorkspace({ showNotification }) {
  const [overview, setOverview] = useState(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeClient, setActiveClient] = useState(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  const refreshOverview = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    setError('');
    try {
      const result = await getAdminAccountingOverview();
      if (!result?.ok) throw new Error(result?.error || 'Accounting overview could not be loaded.');
      setOverview(normalizeOverview(result));
    } catch (reason) {
      setError(reason?.message || 'Accounting overview could not be loaded. Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshOverview();
  }, [refreshOverview]);
  useEffect(() => {
    const onFocus = () => refreshOverview({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshOverview]);

  useEffect(() => {
    if (!activeClient) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setActiveClient(null);
      if (event.key === 'Tab') {
        const dialog = document.querySelector('.aw-drawer');
        const focusable = dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    closeButtonRef.current?.focus();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [activeClient]);

  const monthDate = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, (month || 1) - 1, 1);
  }, [selectedMonth]);
  const monthTitle = useMemo(() => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthDate), [monthDate]);
  const moveMonth = (amount) => {
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + amount, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  const monthInvoices = useMemo(() => overview.invoices.filter((row) => monthKey(row.issue_date) === selectedMonth), [overview.invoices, selectedMonth]);
  const monthPayments = useMemo(() => overview.payments.filter((row) => monthKey(row.payment_date) === selectedMonth), [overview.payments, selectedMonth]);
  const monthServices = useMemo(() => overview.recurringServices.filter((row) => monthKey(row.next_due_date) === selectedMonth), [overview.recurringServices, selectedMonth]);
  const dueInvoices = useMemo(() => overview.invoices.filter((row) => asNumber(row.balance_due) > 0 && String(row.status || '').toLowerCase() !== 'draft'), [overview.invoices]);
  const activeServices = useMemo(() => overview.recurringServices.filter((row) => !['inactive', 'cancelled', 'ended'].includes(String(row.status || '').toLowerCase())), [overview.recurringServices]);

  const query = search.trim().toLowerCase();
  const matchingClients = useMemo(() => overview.clients.filter((client) => {
    if (!query) return true;
    return [client.name, client.company, client.email].some((value) => String(value || '').toLowerCase().includes(query));
  }), [overview.clients, query]);
  const clientById = useMemo(() => new Map(overview.clients.map((client) => [String(client.id), client])), [overview.clients]);
  const accountRows = useMemo(() => {
    const entries = [
      ...monthInvoices.map((row) => ({ kind: 'invoice', date: row.issue_date, id: row.id, clientId: row.client_id, name: row.client_name || clientById.get(String(row.client_id))?.name || 'Client', ref: row.invoice_number || `Invoice ${row.id}`, status: row.status, amount: row.total, currency: row.currency || 'USD', detail: `Due ${dateLabel(row.due_date, { day: '2-digit', month: 'short' })}`, raw: row })),
      ...monthPayments.map((row) => ({ kind: 'payment', date: row.payment_date, id: row.id, clientId: row.client_id, name: row.client_name || clientById.get(String(row.client_id))?.name || 'Client', ref: row.receipt_number || `Receipt ${row.id}`, status: row.status || 'Received', amount: row.amount, currency: row.currency || 'USD', detail: row.payment_method || row.description || 'Payment received', raw: row })),
    ];
    return entries.filter((row) => {
      const textMatch = !query || [row.name, row.ref, row.detail, row.status].some((value) => String(value || '').toLowerCase().includes(query));
      const statusMatch = statusFilter === 'all' || String(row.status).toLowerCase() === statusFilter;
      return textMatch && statusMatch;
    }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [monthInvoices, monthPayments, clientById, query, statusFilter]);

  const openClient = (client) => {
    previousFocusRef.current = document.activeElement;
    setActiveClient(client);
  };
  const notify = (message) => {
    showNotification?.(message);
    if (/created\.|recorded and issue|saved\./i.test(String(message || ''))) refreshOverview({ silent: true });
  };

  return <section className="accounting-workspace" aria-label="Accounting workspace">
    <header className="aw-header">
      <div className="aw-heading">
        <div className="aw-eyebrow"><span className="aw-ledger-mark" aria-hidden="true">A</span><span>FINANCE OPERATIONS <i>·</i> SUPER ADMIN</span></div>
        <h1>Accounting</h1>
        <p>Monthly ledger, client balances, and recurring service schedules.</p>
      </div>
      <div className="aw-header-actions">
        <div className="aw-month-control" aria-label="Selected accounting month">
          <button type="button" className="aw-icon-button" aria-label="Previous month" data-testid="button-month-previous" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button>
          <span data-testid="text-selected-month"><CalendarDays size={15} aria-hidden="true" />{monthTitle}</span>
          <button type="button" className="aw-icon-button" aria-label="Next month" data-testid="button-month-next" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button>
        </div>
        <button type="button" className="aw-button aw-button-quiet" data-testid="button-refresh-accounting" onClick={() => refreshOverview()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'aw-spinning' : ''} aria-hidden="true" />{refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
    </header>

    {error && <div className="aw-error" role="alert" data-testid="status-accounting-error">
      <CircleAlert size={17} aria-hidden="true" /><div><strong>Overview unavailable</strong><span>{error}</span></div>
      <button type="button" className="aw-button aw-button-quiet" data-testid="button-retry-accounting" onClick={() => refreshOverview()}>Try again</button>
    </div>}

    <div className="aw-summary-row" aria-label={`${monthTitle} accounting summary`}>
      <Metric label="Invoices issued" icon={FileText} rows={monthInvoices} amountKey="total" detail={`${monthInvoices.length} invoice${monthInvoices.length === 1 ? '' : 's'} dated this month`} variant="billed" />
      <Metric label="Payments received" icon={ArrowDownLeft} rows={monthPayments} amountKey="amount" detail={`${monthPayments.length} receipt${monthPayments.length === 1 ? '' : 's'} dated this month`} variant="received" />
      <Metric label="Open balances" icon={ArrowUpRight} rows={dueInvoices} amountKey="balance_due" detail={`${dueInvoices.length} invoice${dueInvoices.length === 1 ? '' : 's'} with a remaining balance`} variant="balance" />
      <article className="aw-metric aw-metric-service" data-testid="card-metric-services">
        <div className="aw-metric-top"><span>Service schedules</span><Layers3 size={16} aria-hidden="true" /></div>
        <strong className="aw-metric-count" data-testid="text-active-service-count">{activeServices.length}</strong>
        <p>{monthServices.length} due in {monthTitle}</p>
      </article>
    </div>

    <div className="aw-workbench">
      <div className="aw-workbench-head">
        <div className="aw-tabs" role="tablist" aria-label="Accounting views">
          {[['overview', 'Monthly activity'], ['clients', 'Clients'], ['services', 'Service schedule']].map(([key, label]) =>
            <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'is-active' : ''} data-testid={`tab-accounting-${key}`} onClick={() => setView(key)}>{label}<span>{key === 'overview' ? accountRows.length : key === 'clients' ? matchingClients.length : activeServices.length}</span></button>
          )}
        </div>
        <label className="aw-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === 'clients' ? 'Find a client' : 'Search this view'} aria-label="Search accounting records" data-testid="input-accounting-search" />
        </label>
      </div>

      {view === 'overview' && <div className="aw-panel">
        <div className="aw-section-heading">
          <div><h2>Ledger activity</h2><p>Invoices and receipts by their recorded accounting date.</p></div>
          <label className="aw-filter"><span>Record status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by record status" data-testid="select-accounting-status">
            <option value="all">All statuses</option>
            {[...new Set(accountRows.map((row) => String(row.status || '').toLowerCase()).filter(Boolean))].sort().map((status) => <option key={status} value={status}>{normalizeStatus(status)}</option>)}
          </select></label>
        </div>
        {loading ? <LedgerSkeleton /> : accountRows.length ? <div className="aw-table-wrap">
          <table className="aw-table">
            <thead><tr><th scope="col">Record</th><th scope="col">Client</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col" className="aw-align-right">Amount</th><th scope="col" className="aw-action-column"><span className="aw-visually-hidden">Action</span></th></tr></thead>
            <tbody>{accountRows.map((row) => <tr key={`${row.kind}-${row.id}`} data-testid={`row-ledger-${row.kind}-${row.id}`}>
              <td><div className="aw-record-cell"><span className={`aw-record-icon aw-record-${row.kind}`}>{row.kind === 'invoice' ? <FileText size={14} /> : <CreditCard size={14} />}</span><span><strong>{row.ref}</strong><small>{row.detail}</small></span></div></td>
              <td><button className="aw-client-link" type="button" data-testid={`button-open-client-${row.clientId}`} onClick={() => {
                const client = clientById.get(String(row.clientId)) || { id: row.clientId, name: row.name, email: row.raw.client_email || '' };
                openClient(client);
              }}>{row.name}</button></td>
              <td className="aw-date-cell">{dateLabel(row.date)}</td>
              <td><StatusBadge value={row.status} testId={`status-ledger-${row.kind}-${row.id}`} /></td>
              <td className="aw-align-right aw-amount">{currencyLabel(row.amount, row.currency)}</td>
              <td className="aw-action-column"><button type="button" className="aw-row-action" data-testid={`button-manage-ledger-${row.clientId}`} onClick={() => {
                const client = clientById.get(String(row.clientId)) || { id: row.clientId, name: row.name, email: row.raw.client_email || '' };
                openClient(client);
              }}>Open ledger</button></td>
            </tr>)}</tbody>
          </table>
        </div> : <EmptyState title={monthInvoices.length + monthPayments.length ? 'No records match these filters' : `No ledger activity in ${monthTitle}`} detail={monthInvoices.length + monthPayments.length ? 'Adjust the search or status filter to see more records.' : 'Invoices and received payments will appear here when they are recorded.'} />}
      </div>}

      {view === 'clients' && <div className="aw-panel">
        <div className="aw-section-heading"><div><h2>Client accounts</h2><p>Open a shared ledger to review and record client accounting.</p></div><span className="aw-count-label" data-testid="text-client-count">{matchingClients.length} clients</span></div>
        {loading ? <LedgerSkeleton /> : matchingClients.length ? <div className="aw-client-grid">
          {matchingClients.map((client) => {
            const invoices = overview.invoices.filter((row) => String(row.client_id) === String(client.id));
            const clientServices = overview.recurringServices.filter((row) => String(row.client_id) === String(client.id));
            return <article className="aw-client-card" key={client.id} data-testid={`card-client-${client.id}`}>
              <div className="aw-client-card-head"><span className="aw-client-monogram" aria-hidden="true">{(client.name || client.company || 'C').trim().slice(0, 1).toUpperCase()}</span>
                <div className="aw-client-identity"><strong data-testid={`text-client-name-${client.id}`}>{client.name || client.company || 'Unnamed client'}</strong><span data-testid={`text-client-contact-${client.id}`}>{client.company && client.company !== client.name ? client.company : (client.email || 'No email on file')}</span></div>
                <StatusBadge value={client.status} testId={`status-client-${client.id}`} />
              </div>
              <div className="aw-client-facts"><span><small>Open invoices</small><strong>{invoices.filter((row) => asNumber(row.balance_due) > 0).length}</strong></span><span><small>Schedules</small><strong>{clientServices.length}</strong></span></div>
              <button type="button" className="aw-button aw-button-open" data-testid={`button-manage-client-${client.id}`} onClick={() => openClient(client)}>Manage ledger <ChevronRight size={15} aria-hidden="true" /></button>
            </article>;
          })}
        </div> : <EmptyState title={query ? 'No clients found' : 'No client accounts yet'} detail={query ? 'Try a different name, company, or email.' : 'Client accounting records will appear here when available.'} />}
      </div>}

      {view === 'services' && <div className="aw-panel">
        <div className="aw-section-heading"><div><h2>Recurring service schedule</h2><p>Scheduled services only. Invoices are created explicitly from a client ledger.</p></div><span className="aw-count-label" data-testid="text-service-count">{activeServices.length} active schedules</span></div>
        {loading ? <LedgerSkeleton /> : activeServices.length ? <div className="aw-table-wrap">
          <table className="aw-table aw-service-table"><thead><tr><th scope="col">Service</th><th scope="col">Client</th><th scope="col">Frequency</th><th scope="col">Next due</th><th scope="col">Status</th><th scope="col" className="aw-align-right">Schedule amount</th><th scope="col" className="aw-action-column"><span className="aw-visually-hidden">Action</span></th></tr></thead>
            <tbody>{activeServices.filter((row) => !query || [row.service_name, row.service_type, row.client_name, row.client_email].some((value) => String(value || '').toLowerCase().includes(query))).map((row) => <tr key={row.id} data-testid={`row-service-${row.id}`}>
              <td><div className="aw-service-name"><strong>{row.service_name || row.service_type || 'Recurring service'}</strong><small>{row.description || row.service_type || 'Scheduled service'}</small></div></td>
              <td>{row.client_name || clientById.get(String(row.client_id))?.name || 'Client'}</td>
              <td>{row.billing_frequency || 'Not set'}</td>
              <td className="aw-date-cell" data-testid={`text-service-due-${row.id}`}>{dateLabel(row.next_due_date)}</td><td><StatusBadge value={row.status} testId={`status-service-${row.id}`} /></td>
              <td className="aw-align-right aw-amount">{currencyLabel(row.amount, row.currency)}</td>
              <td className="aw-action-column"><button type="button" className="aw-row-action" data-testid={`button-open-service-client-${row.id}`} onClick={() => {
                const client = clientById.get(String(row.client_id)) || { id: row.client_id, name: row.client_name || 'Client', email: row.client_email || '' };
                openClient(client);
              }}>Open ledger</button></td>
            </tr>)}</tbody>
          </table>
        </div> : <EmptyState title={query ? 'No schedules match your search' : 'No recurring schedules'} detail={query ? 'Try searching by client or service name.' : 'Recurring services will be listed here when configured for a client.'} />}
        <div className="aw-schedule-note"><Clock3 size={15} aria-hidden="true" /><span>A schedule tracks expected billing dates; it does not create an invoice or charge a client.</span></div>
        {(overview.hosting.length > 0 || overview.domains.length > 0) && <TrackedAssets hosting={overview.hosting} domains={overview.domains} clients={clientById} onOpen={openClient} />}
      </div>}
    </div>

    <footer className="aw-footer" data-testid="text-accounting-data-note"><span>Ledger source: recorded invoices and payments</span><span>Amounts remain grouped by currency</span></footer>

    {activeClient && <div className="aw-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveClient(null); }}>
      <section className="aw-drawer" role="dialog" aria-modal="true" aria-labelledby="aw-drawer-title" data-testid="dialog-client-accounting">
        <header className="aw-drawer-header"><div><span className="aw-drawer-kicker">CLIENT LEDGER</span><h2 id="aw-drawer-title">{activeClient.name || activeClient.company || 'Client accounting'}</h2>{activeClient.email && <p>{activeClient.email}</p>}</div>
          <button ref={closeButtonRef} type="button" className="aw-icon-button aw-close-button" aria-label="Close client ledger" data-testid="button-close-client-ledger" onClick={() => setActiveClient(null)}><X size={18} /></button>
        </header>
        <div className="aw-drawer-content"><ClientAccountingPanel clientId={activeClient.id} showNotification={notify} canEdit onSaved={() => refreshOverview({ silent: true })} /></div>
      </section>
    </div>}
  </section>;
}

function LedgerSkeleton() {
  return <div className="aw-skeleton-list" aria-label="Loading accounting records" data-testid="status-accounting-loading">
    {[0, 1, 2, 3].map((item) => <div className="aw-skeleton-row" key={item}><span /><span /><span /><span /></div>)}
  </div>;
}

function EmptyState({ title, detail }) {
  return <div className="aw-empty-state" data-testid="status-accounting-empty"><span className="aw-empty-rule" aria-hidden="true" /><strong>{title}</strong><p>{detail}</p></div>;
}

function TrackedAssets({ hosting, domains, clients, onOpen }) {
  return <section className="aw-assets"><div className="aw-section-heading"><div><h3>Hosting &amp; domain renewals</h3><p>Tracked client assets and renewal dates.</p></div></div>
    <div className="aw-assets-list">
      {hosting.map((row) => <article className="aw-asset-row" key={`hosting-${row.id}`} data-testid={`row-hosting-${row.id}`}>
        <span className="aw-asset-type">HOSTING</span><div className="aw-asset-main"><strong>{row.website_name || row.plan || 'Hosting plan'}</strong><small>{row.provider || 'Provider'} · {row.plan || row.billing_frequency || 'Plan not specified'}</small></div>
        <span className="aw-asset-date" data-testid={`text-hosting-renewal-${row.id}`}>{dateLabel(row.renewal_date)}</span><StatusBadge value={row.status} testId={`status-hosting-${row.id}`} />
        <button type="button" className="aw-row-action" data-testid={`button-open-hosting-client-${row.id}`} onClick={() => onOpen(clients.get(String(row.client_id)) || { id: row.client_id, name: 'Client' })}>Open ledger</button>
      </article>)}
      {domains.map((row) => <article className="aw-asset-row" key={`domain-${row.id}`} data-testid={`row-domain-${row.id}`}>
        <span className="aw-asset-type aw-domain-type">DOMAIN</span><div className="aw-asset-main"><strong>{row.domain_name || 'Domain'}</strong><small>{row.registrar || 'Registrar not specified'}</small></div>
        <span className="aw-asset-date" data-testid={`text-domain-expiration-${row.id}`}>{dateLabel(row.expiration_date)}</span><StatusBadge value={row.renewal_status} testId={`status-domain-${row.id}`} />
        <button type="button" className="aw-row-action" data-testid={`button-open-domain-client-${row.id}`} onClick={() => onOpen(clients.get(String(row.client_id)) || { id: row.client_id, name: 'Client' })}>Open ledger</button>
      </article>)}
    </div>
  </section>;
}