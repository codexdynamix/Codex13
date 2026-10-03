import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, CreditCard, Download, FileSpreadsheet, FileText, Layers3, ListChecks, Plus, RefreshCw, Search, X } from 'lucide-react';
import { getAdminAccountingOverview, invoiceDueRecurringServices } from '../adminApi.js';
import ClientAccountingPanel from './ClientAccountingPanel.jsx';
import InvoiceFollowupForm from './InvoiceFollowupForm.jsx';
import './accounting-workspace.css';

const emptyOverview = { clients: [], invoices: [], payments: [], recurringServices: [], hosting: [], domains: [], followups: [] };
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
  hosting: asArray(payload?.hosting).map((row) => ({ ...row, amount: asNumber(row.amount), currency: row.currency || 'USD' })),
  domains: asArray(payload?.domains).map((row) => ({ ...row, renewal_amount: row.renewal_amount == null || row.renewal_amount === '' ? null : asNumber(row.renewal_amount), currency: row.currency || 'USD' })),
  followups: asArray(payload?.followups),
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
const todayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};
const dateKey = (value) => String(value || '').slice(0, 10);
const hasDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey(value));
const addDaysKey = (amount) => {
  const date = new Date();
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const invoiceServices = (invoice) => {
  let items = invoice?.line_items || invoice?.lineItems || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  return asArray(items)
    .map((item) => String(item?.service || item?.description || '').trim())
    .filter(Boolean)
    .filter((service, index, services) => services.indexOf(service) === index)
    .join(' · ');
};
const normalizeStatus = (value) => String(value || 'Unspecified').trim();
const invoiceDisplayStatus = (invoice, today = todayKey()) => {
  const status = normalizeStatus(invoice?.status);
  return asNumber(invoice?.balance_due) > 0
    && status.toLowerCase() !== 'draft'
    && invoice?.due_date
    && String(invoice.due_date).slice(0, 10) < today
    ? 'Overdue'
    : status;
};
const monthlyEquivalent = (amount, frequency = 'Monthly') => {
  const value = asNumber(amount);
  const label = String(frequency || '').toLowerCase();
  if (/one.?time|once/.test(label)) return 0;
  if (/bi.?weekly/.test(label)) return value * 26 / 12;
  if (/semi.?monthly/.test(label)) return value * 2;
  if (/year|annual/.test(label)) return value / 12;
  if (/quarter/.test(label)) return value / 3;
  if (/week/.test(label)) return value * 52 / 12;
  return value;
};
const statusTone = (value) => {
  const status = String(value || '').toLowerCase();
  if (['paid', 'active', 'received', 'complete', 'completed'].includes(status)) return 'positive';
  if (['overdue', 'failed', 'cancelled', 'inactive', 'expired', 'voided'].includes(status)) return 'negative';
  if (['draft', 'pending', 'scheduled', 'upcoming', 'due', 'review renewal', 'partially paid'].includes(status)) return 'caution';
  return 'neutral';
};
const csvCell = (value) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};
function downloadCsv(filename, rows) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

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
  const [clientSort, setClientSort] = useState('name');
  const [view, setView] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recordKindFilter, setRecordKindFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [batchReviewOpen, setBatchReviewOpen] = useState(false);
  const [batchSelection, setBatchSelection] = useState([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [activeClient, setActiveClient] = useState(null);
  const [activeClientMode, setActiveClientMode] = useState('');
  const [globalActionMode, setGlobalActionMode] = useState('');
  const [globalActionClientId, setGlobalActionClientId] = useState('');
  const [followupTarget, setFollowupTarget] = useState(null);
  const closeButtonRef = useRef(null);
  const globalActionCloseRef = useRef(null);
  const followupCloseRef = useRef(null);
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
      if (event.key === 'Escape') {
        setActiveClient(null);
        setActiveClientMode('');
      }
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

  useEffect(() => {
    if (!globalActionMode) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setGlobalActionMode('');
      if (event.key === 'Tab') {
        const dialog = document.querySelector('.aw-client-picker');
        const focusable = dialog?.querySelectorAll('button:not([disabled]), select:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    globalActionCloseRef.current?.focus();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [globalActionMode]);

  useEffect(() => {
    if (!followupTarget) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setFollowupTarget(null);
      if (event.key === 'Tab') {
        const dialog = document.querySelector('.aw-followup-dialog');
        const focusable = dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    followupCloseRef.current?.focus();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [followupTarget]);

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
  const monthIssuedInvoices = useMemo(() => monthInvoices.filter((row) => String(row.status || '').toLowerCase() !== 'draft'), [monthInvoices]);
  const monthReceivedPayments = useMemo(() => monthPayments.filter((row) => ['completed', 'received', 'paid', 'partially paid'].includes(String(row.status || '').toLowerCase())), [monthPayments]);
  const monthServices = useMemo(() => overview.recurringServices.filter((row) => monthKey(row.next_due_date) === selectedMonth), [overview.recurringServices, selectedMonth]);
  const dueInvoices = useMemo(() => overview.invoices.filter((row) => asNumber(row.balance_due) > 0 && String(row.status || '').toLowerCase() !== 'draft'), [overview.invoices]);
  const overdueInvoices = useMemo(() => dueInvoices.filter((row) => invoiceDisplayStatus(row) === 'Overdue'), [dueInvoices]);
  const activeServices = useMemo(() => overview.recurringServices.filter((row) => String(row.status || '').toLowerCase() === 'active'), [overview.recurringServices]);
  const monthlyEquivalentServices = useMemo(() => [
    ...activeServices.map((row) => ({
      ...row,
      amount: monthlyEquivalent(row.amount, row.billing_frequency),
    })),
    ...overview.hosting.filter((row) => asNumber(row.amount) > 0 && String(row.status || '').toLowerCase() === 'active').map((row) => ({
      ...row,
      amount: monthlyEquivalent(row.amount, row.billing_frequency),
    })),
    ...overview.domains.filter((row) => row.renewal_amount != null && asNumber(row.renewal_amount) > 0 && !/expired|cancelled|inactive/i.test(String(row.renewal_status || ''))).map((row) => ({
      ...row,
      amount: asNumber(row.renewal_amount) / 12,
      billing_frequency: 'Yearly',
    })),
  ], [activeServices, overview.hosting, overview.domains]);
  const dueRecurringServices = useMemo(() => activeServices.filter((row) => hasDateKey(row.next_due_date) && dateKey(row.next_due_date) <= todayKey()), [activeServices]);

  const query = search.trim().toLowerCase();
  const matchingClients = useMemo(() => overview.clients.filter((client) => {
    if (!query) return true;
    return [client.name, client.company, client.email, client.phone].some((value) => String(value || '').toLowerCase().includes(query));
  }), [overview.clients, query]);
  const clientById = useMemo(() => new Map(overview.clients.map((client) => [String(client.id), client])), [overview.clients]);
  const invoiceById = useMemo(() => new Map(overview.invoices.map((invoice) => [String(invoice.id), invoice])), [overview.invoices]);
  const latestFollowupByInvoice = useMemo(() => {
    const latest = new Map();
    for (const followup of overview.followups) {
      if (!latest.has(String(followup.invoice_id))) latest.set(String(followup.invoice_id), followup);
    }
    return latest;
  }, [overview.followups]);
  const clientRows = useMemo(() => {
    const invoicesByClient = new Map();
    for (const invoice of overview.invoices) {
      const key = String(invoice.client_id);
      if (!invoicesByClient.has(key)) invoicesByClient.set(key, []);
      invoicesByClient.get(key).push(invoice);
    }
    const servicesByClient = new Map();
    for (const service of overview.recurringServices) {
      const key = String(service.client_id);
      if (!servicesByClient.has(key)) servicesByClient.set(key, []);
      servicesByClient.get(key).push(service);
    }
    return matchingClients.map((client) => {
      const invoices = invoicesByClient.get(String(client.id)) || [];
      const openInvoices = invoices.filter((row) => asNumber(row.balance_due) > 0 && String(row.status || '').toLowerCase() !== 'draft');
      const overdueInvoices = openInvoices.filter((row) => invoiceDisplayStatus(row) === 'Overdue');
      const clientServices = (servicesByClient.get(String(client.id)) || []).filter((row) => !['inactive', 'cancelled', 'ended'].includes(String(row.status || '').toLowerCase()));
      return { client, openInvoices, overdueInvoices, clientServices };
    });
  }, [matchingClients, overview.invoices, overview.recurringServices]);
  const sortedClientRows = useMemo(() => [...clientRows].sort((a, b) => {
    if (clientSort === 'overdue') return b.overdueInvoices.length - a.overdueInvoices.length || String(a.client.name || a.client.company || '').localeCompare(String(b.client.name || b.client.company || ''));
    if (clientSort === 'open') return b.openInvoices.length - a.openInvoices.length || String(a.client.name || a.client.company || '').localeCompare(String(b.client.name || b.client.company || ''));
    return String(a.client.name || a.client.company || '').localeCompare(String(b.client.name || b.client.company || ''));
  }), [clientRows, clientSort]);
  const accountRows = useMemo(() => {
    const entries = [
      ...monthInvoices.map((row) => {
        const services = invoiceServices(row);
        return {
          kind: 'invoice', date: row.issue_date, id: row.id, clientId: row.client_id,
          name: row.client_name || clientById.get(String(row.client_id))?.name || 'Client',
          ref: row.invoice_number || `Invoice ${row.id}`, status: invoiceDisplayStatus(row),
          amount: row.total, currency: row.currency || 'USD',
          detail: [services, `Due ${dateLabel(row.due_date, { day: '2-digit', month: 'short' })}`].filter(Boolean).join(' · '),
          raw: row,
        };
      }),
      ...monthPayments.map((row) => {
        const invoice = row.invoice_id ? invoiceById.get(String(row.invoice_id)) : null;
        const services = invoice ? invoiceServices(invoice) : '';
        return {
          kind: 'payment', date: row.payment_date, id: row.id, clientId: row.client_id,
          name: row.client_name || clientById.get(String(row.client_id))?.name || 'Client',
          ref: row.receipt_number || `Receipt ${row.id}`, status: row.status || 'Received',
          amount: row.amount, currency: row.currency || 'USD',
          detail: [row.payment_method || 'Payment', invoice?.invoice_number, services, !invoice ? row.description : ''].filter(Boolean).join(' · '),
          raw: row,
        };
      }),
    ];
    return entries.filter((row) => {
      const textMatch = !query || [row.name, row.ref, row.detail, row.status].some((value) => String(value || '').toLowerCase().includes(query));
      const statusMatch = statusFilter === 'all' || String(row.status).toLowerCase() === statusFilter;
      const kindMatch = recordKindFilter === 'all' || row.kind === recordKindFilter;
      const clientMatch = clientFilter === 'all' || String(row.clientId) === clientFilter;
      return textMatch && statusMatch && kindMatch && clientMatch;
    }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [monthInvoices, monthPayments, clientById, invoiceById, query, statusFilter, recordKindFilter, clientFilter]);
  const dueWorkRows = useMemo(() => {
    const cutoff = addDaysKey(30);
    const clientName = (clientId, fallback) => fallback || clientById.get(String(clientId))?.name || 'Client';
    const rows = [
      ...dueInvoices.filter((row) => hasDateKey(row.due_date) && dateKey(row.due_date) <= cutoff).map((row) => ({
        kind: 'invoice', id: row.id, clientId: row.client_id, name: clientName(row.client_id, row.client_name),
        ref: row.invoice_number || `Invoice ${row.id}`, dueDate: row.due_date,
        amount: row.balance_due, currency: row.currency || 'USD', status: invoiceDisplayStatus(row), invoice: row,
      })),
      ...activeServices.filter((row) => hasDateKey(row.next_due_date) && dateKey(row.next_due_date) <= cutoff).map((row) => ({
        kind: 'recurring service', id: row.id, clientId: row.client_id, name: clientName(row.client_id, row.client_name),
        ref: row.service_name || row.service_type || 'Recurring service', dueDate: row.next_due_date,
        amount: row.amount, currency: row.currency || 'USD',
        status: dateKey(row.next_due_date) <= todayKey() ? 'Due' : 'Upcoming',
        billable: dateKey(row.next_due_date) <= todayKey(),
      })),
      ...overview.hosting.filter((row) => hasDateKey(row.renewal_date) && dateKey(row.renewal_date) <= cutoff && !['inactive', 'cancelled', 'ended'].includes(String(row.status || '').toLowerCase())).map((row) => ({
        kind: 'hosting renewal', id: row.id, clientId: row.client_id, name: clientName(row.client_id, row.client_name),
        ref: row.website_name || row.plan || 'Hosting', dueDate: row.renewal_date,
        amount: asNumber(row.amount) > 0 ? row.amount : null, currency: row.currency || 'USD', status: 'Review renewal',
      })),
      ...overview.domains.filter((row) => hasDateKey(row.expiration_date) && dateKey(row.expiration_date) <= cutoff && !/cancelled|inactive/i.test(String(row.renewal_status || ''))).map((row) => ({
        kind: 'domain renewal', id: row.id, clientId: row.client_id, name: clientName(row.client_id, row.client_name),
        ref: row.domain_name || 'Domain', dueDate: row.expiration_date,
        amount: row.renewal_amount != null && asNumber(row.renewal_amount) > 0 ? row.renewal_amount : null, currency: row.currency || 'USD', status: 'Review renewal',
      })),
    ];
    return rows.filter((row) => !query || [row.kind, row.name, row.ref, row.status].some((value) => String(value || '').toLowerCase().includes(query)))
      .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  }, [dueInvoices, activeServices, overview.hosting, overview.domains, clientById, query]);
  const matchingServices = useMemo(() => activeServices.filter((row) => !query || [row.service_name, row.service_type, row.client_name, row.client_email].some((value) => String(value || '').toLowerCase().includes(query))), [activeServices, query]);
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil((view === 'overview' ? accountRows.length : view === 'clients' ? matchingClients.length : view === 'services' ? matchingServices.length : dueWorkRows.length) / pageSize));
  const ledgerPageRows = accountRows.slice((page - 1) * pageSize, page * pageSize);
  const clientPageRows = sortedClientRows.slice((page - 1) * pageSize, page * pageSize);
  const servicePageRows = matchingServices.slice((page - 1) * pageSize, page * pageSize);
  const duePageRows = dueWorkRows.slice((page - 1) * pageSize, page * pageSize);
  const selectedBatchServices = dueRecurringServices.filter((row) => batchSelection.includes(String(row.id)));
  const batchTotals = selectedBatchServices.reduce((totals, row) => {
    const currency = row.currency || 'USD';
    totals.set(currency, (totals.get(currency) || 0) + asNumber(row.amount));
    return totals;
  }, new Map());

  useEffect(() => { setPage(1); }, [view, selectedMonth, search, statusFilter, recordKindFilter, clientFilter, clientSort]);
  const openClient = (client, mode = '', preserveReturnFocus = true) => {
    if (preserveReturnFocus) previousFocusRef.current = document.activeElement;
    setActiveClientMode(mode);
    setActiveClient(client);
  };
  const closeClient = () => {
    setActiveClient(null);
    setActiveClientMode('');
  };
  const openGlobalAction = (mode) => {
    previousFocusRef.current = document.activeElement;
    setGlobalActionMode(mode);
    setGlobalActionClientId('');
  };
  const continueGlobalAction = (event) => {
    event.preventDefault();
    const client = clientById.get(String(globalActionClientId));
    if (!client) return;
    const mode = globalActionMode;
    setGlobalActionMode('');
    openClient(client, mode, false);
  };
  const openFollowup = (clientId, clientName, invoice) => {
    previousFocusRef.current = document.activeElement;
    setFollowupTarget({ clientId, clientName, invoice });
  };
  const notify = (message) => {
    showNotification?.(message);
    if (/created\.|recorded and issue|saved\./i.test(String(message || ''))) refreshOverview({ silent: true });
  };
  const finishFollowup = async () => {
    setFollowupTarget(null);
    await refreshOverview({ silent: true });
    showNotification?.('Follow-up saved to history. No email was sent.');
  };
  const openBatchReview = (serviceIds = dueRecurringServices.map((row) => String(row.id))) => {
    setBatchSelection(serviceIds.slice(0, 100));
    setBatchReviewOpen(true);
  };
  const toggleBatchService = (serviceId) => {
    setBatchSelection((current) => current.includes(String(serviceId))
      ? current.filter((id) => id !== String(serviceId))
      : current.length < 100 ? [...current, String(serviceId)] : current);
  };
  const confirmBatchInvoice = async () => {
    if (!selectedBatchServices.length) return;
    setBatchBusy(true);
    setError('');
    try {
      const result = await invoiceDueRecurringServices(selectedBatchServices.map((row) => String(row.id)));
      const count = Number(result?.count || result?.invoices?.length || selectedBatchServices.length);
      setBatchReviewOpen(false);
      setBatchSelection([]);
      showNotification?.(`${count} recurring invoice${count === 1 ? '' : 's'} created.`);
      await refreshOverview({ silent: true });
    } catch (reason) {
      setError(reason?.message || 'The recurring invoice batch could not be completed.');
    } finally {
      setBatchBusy(false);
    }
  };
  const exportMonthlyActivity = () => {
    const rows = [
      ['Date', 'Client', 'Record type', 'Reference', 'Status', 'Currency', 'Amount', 'Balance due', 'Details'],
      ...accountRows.map((row) => [
        row.date, row.name, row.kind, row.ref, row.status, row.currency, row.amount,
        row.kind === 'invoice' ? row.raw.balance_due : '', row.detail,
      ]),
    ];
    downloadCsv(`accounting-activity-${selectedMonth}.csv`, rows);
  };
  const exportClientBalances = () => {
    const totals = new Map();
    overview.invoices.filter((invoice) => asNumber(invoice.balance_due) > 0 && String(invoice.status || '').toLowerCase() !== 'draft').forEach((invoice) => {
      const key = `${invoice.client_id}|${invoice.currency || 'USD'}`;
      const current = totals.get(key) || { clientId: invoice.client_id, currency: invoice.currency || 'USD', balance: 0, invoiceCount: 0 };
      current.balance += asNumber(invoice.balance_due);
      current.invoiceCount += 1;
      totals.set(key, current);
    });
    const rows = [
      ['Client', 'Company', 'Email', 'Client ID', 'Currency', 'Open balance', 'Open invoices'],
      ...[...totals.values()].map((row) => {
        const client = clientById.get(String(row.clientId)) || {};
        return [client.name || client.company || 'Client', client.company || '', client.email || '', row.clientId, row.currency, row.balance, row.invoiceCount];
      }),
    ];
    downloadCsv(`client-open-balances-${todayKey()}.csv`, rows);
  };

  return <section className="accounting-workspace" aria-label="Accounting workspace">
    <header className="aw-header">
      <div className="aw-heading">
        <div className="aw-eyebrow"><span className="aw-ledger-mark" aria-hidden="true">A</span><span>FINANCE OPERATIONS <i>·</i> SUPER ADMIN</span></div>
        <h1>Accounting</h1>
        <p>Monthly ledger, client balances, and recurring service schedules.</p>
      </div>
      <div className="aw-header-actions">
        <div className="aw-month-control" role="group" aria-label="Selected accounting month">
          <button type="button" className="aw-icon-button" aria-label="Previous month" data-testid="button-month-previous" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button>
          <span data-testid="text-selected-month">{monthTitle}</span>
          <button
            type="button"
            className="aw-icon-button aw-month-picker-trigger"
            aria-label="Choose accounting month"
            aria-haspopup="dialog"
            aria-expanded={monthPickerOpen}
            aria-controls="aw-month-picker"
            data-testid="button-open-accounting-month-picker"
            onClick={() => setMonthPickerOpen((open) => !open)}
          ><CalendarDays size={15} aria-hidden="true" /></button>
          <button type="button" className="aw-icon-button" aria-label="Next month" data-testid="button-month-next" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button>
          {monthPickerOpen && <div className="aw-month-picker-popover" id="aw-month-picker" role="dialog" aria-label="Choose accounting month">
            <label htmlFor="aw-month-picker-input">Go to month</label>
            <input
              className="aw-month-picker-input"
              id="aw-month-picker-input"
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                if (event.target.value) {
                  setSelectedMonth(event.target.value);
                  setMonthPickerOpen(false);
                }
              }}
              data-testid="input-accounting-month"
            />
            <button type="button" className="aw-button aw-button-quiet aw-month-picker-done" onClick={() => setMonthPickerOpen(false)}>Done</button>
          </div>}
        </div>
        <button type="button" className="aw-button aw-button-quiet" disabled={loading || !overview.clients.length} onClick={() => openGlobalAction('invoice')} data-testid="button-global-new-invoice"><Plus size={14} aria-hidden="true" />New invoice</button>
        <button type="button" className="aw-button aw-button-primary" disabled={loading || !overview.clients.length} onClick={() => openGlobalAction('payment')} data-testid="button-global-record-payment"><Plus size={14} aria-hidden="true" />Record payment</button>
        <button type="button" className="aw-button aw-button-quiet" data-testid="button-refresh-accounting" onClick={() => refreshOverview()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'aw-spinning' : ''} aria-hidden="true" />{refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
    </header>

    {error && <div className="aw-error" role="alert" data-testid="status-accounting-error">
      <CircleAlert size={17} aria-hidden="true" /><div><strong>Overview unavailable</strong><span>{error}</span></div>
      <button type="button" className="aw-button aw-button-quiet" data-testid="button-retry-accounting" onClick={() => refreshOverview()}>Try again</button>
    </div>}

    <div className="aw-metric-groups">
      <section className="aw-metric-group aw-metric-period" aria-label={`${monthTitle} activity totals`}>
        <div className="aw-metric-group-heading"><h2>Selected-month activity</h2><span>{monthTitle} · by accounting date</span></div>
        <div className="aw-summary-row">
          <Metric label="Invoices issued" icon={FileText} rows={monthIssuedInvoices} amountKey="total" detail={`${monthIssuedInvoices.length} issued invoice${monthIssuedInvoices.length === 1 ? '' : 's'} dated in ${monthTitle}`} variant="billed" />
          <Metric label="Payments received" icon={ArrowDownLeft} rows={monthReceivedPayments} amountKey="amount" detail={`${monthReceivedPayments.length} valid receipt${monthReceivedPayments.length === 1 ? '' : 's'} dated in ${monthTitle}`} variant="received" />
        </div>
      </section>
      <section className="aw-metric-group aw-metric-current" aria-label="Current portfolio totals">
        <div className="aw-metric-group-heading"><h2>Current portfolio</h2><span>All clients · open balances and active services</span></div>
        <div className="aw-summary-row">
          <Metric label="Open balances" icon={ArrowUpRight} rows={dueInvoices} amountKey="balance_due" detail={`${dueInvoices.length} open invoice${dueInvoices.length === 1 ? '' : 's'} across all clients`} variant="balance" />
          <Metric label="Overdue balances" icon={CircleAlert} rows={overdueInvoices} amountKey="balance_due" detail={`${overdueInvoices.length} past-due invoice${overdueInvoices.length === 1 ? '' : 's'}`} variant="overdue" />
          <Metric label="Monthly service equivalent" icon={Layers3} rows={monthlyEquivalentServices} amountKey="amount" detail={`${activeServices.length} schedules plus priced hosting and domains · ${monthServices.length} schedules due in ${monthTitle}; yearly fees divided by 12`} variant="service" />
        </div>
      </section>
    </div>

    <div className="aw-workbench">
      <div className="aw-workbench-head">
        <div className="aw-tabs" role="tablist" aria-label="Accounting views">
          {[['overview', 'Monthly activity'], ['due', 'Due work'], ['clients', 'Clients'], ['services', 'Service schedule']].map(([key, label]) =>
            <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'is-active' : ''} data-testid={`tab-accounting-${key}`} onClick={() => setView(key)}>{label}<span>{key === 'overview' ? accountRows.length : key === 'due' ? dueWorkRows.length : key === 'clients' ? matchingClients.length : activeServices.length}</span></button>
          )}
        </div>
        {view !== 'clients' && <div className="aw-search">
          <Search size={15} aria-hidden="true" />
          <input className="aw-search-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this view" aria-label="Search accounting records" data-testid="input-accounting-search" />
          {search && <button type="button" className="aw-search-clear" aria-label="Clear search" onClick={() => setSearch('')} data-testid="button-clear-accounting-search"><X size={14} aria-hidden="true" /></button>}
        </div>}
      </div>

      {view === 'overview' && <div className="aw-panel">
        <div className="aw-section-heading aw-ledger-heading">
          <div><h2>Ledger activity</h2><p>Invoices and receipts by their recorded accounting date.</p></div>
          <div className="aw-ledger-tools">
            <label className="aw-filter"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by record status" data-testid="select-accounting-status">
              <option value="all">All statuses</option>
              {[...new Set([...monthInvoices.map((row) => invoiceDisplayStatus(row)), ...monthPayments.map((row) => row.status || 'Received')].map((status) => String(status || '').toLowerCase()).filter(Boolean))].sort().map((status) => <option key={status} value={status}>{normalizeStatus(status)}</option>)}
            </select></label>
            <label className="aw-filter"><span>Type</span><select value={recordKindFilter} onChange={(event) => setRecordKindFilter(event.target.value)} aria-label="Filter by record type" data-testid="select-accounting-kind">
              <option value="all">All records</option><option value="invoice">Invoices</option><option value="payment">Payments</option>
            </select></label>
            <label className="aw-filter"><span>Client</span><select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} aria-label="Filter by client" data-testid="select-accounting-client">
              <option value="all">All clients</option>
              {overview.clients.map((client) => <option key={client.id} value={String(client.id)}>{client.name || client.company || 'Client'}</option>)}
            </select></label>
            <button type="button" className="aw-button aw-button-quiet" onClick={exportMonthlyActivity} data-testid="button-export-monthly-csv"><Download size={14} aria-hidden="true" />Activity CSV</button>
            <button type="button" className="aw-button aw-button-quiet" onClick={exportClientBalances} data-testid="button-export-client-balances-csv"><FileSpreadsheet size={14} aria-hidden="true" />Balances CSV</button>
          </div>
        </div>
        {loading ? <LedgerSkeleton /> : accountRows.length ? <div className="aw-table-wrap">
          <table className="aw-table">
            <thead><tr><th scope="col">Record</th><th scope="col">Client</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col" className="aw-align-right">Amount</th><th scope="col" className="aw-action-column"><span className="aw-visually-hidden">Action</span></th></tr></thead>
            <tbody>{ledgerPageRows.map((row) => <tr key={`${row.kind}-${row.id}`} data-testid={`row-ledger-${row.kind}-${row.id}`}>
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
        </div> : <EmptyState title={monthInvoices.length + monthPayments.length ? 'No records match these filters' : `No ledger activity in ${monthTitle}`} detail={monthInvoices.length + monthPayments.length ? 'Adjust the search or ledger filters to see more records.' : 'Invoices and received payments will appear here when they are recorded.'} />}
        {!loading && accountRows.length > pageSize && <Pagination page={page} pageCount={pageCount} onPage={setPage} itemCount={accountRows.length} />}
      </div>}

      {view === 'due' && <div className="aw-panel">
        <div className="aw-section-heading aw-due-heading">
          <div><h2>Due work</h2><p>Outstanding invoices, recurring billing, and renewals due within 30 days.</p></div>
          {dueRecurringServices.length > 0 && <button type="button" className="aw-button aw-button-primary" onClick={() => openBatchReview()} data-testid="button-review-due-invoices">
            <ListChecks size={15} aria-hidden="true" />Review recurring batch ({dueRecurringServices.length})
          </button>}
        </div>
        {loading ? <LedgerSkeleton /> : dueWorkRows.length ? <div className="aw-table-wrap" role="region" tabIndex="0" aria-label="Due work table; scroll horizontally to review columns">
          <table className="aw-table aw-due-table">
            <thead><tr><th scope="col">Due date</th><th scope="col">Work item</th><th scope="col">Client</th><th scope="col">Status</th><th scope="col" className="aw-align-right">Amount</th><th scope="col" className="aw-action-column"><span className="aw-visually-hidden">Action</span></th></tr></thead>
            <tbody>{duePageRows.map((row) => <tr key={`${row.kind}-${row.id}`} data-testid={`row-due-work-${row.kind.replace(/\s+/g, '-')}-${row.id}`}>
              <td className="aw-date-cell">{dateLabel(row.dueDate)}</td>
              <td><div className="aw-record-cell"><span className={`aw-record-icon ${row.kind.includes('renewal') ? 'aw-record-renewal' : row.kind === 'recurring service' ? 'aw-record-service' : 'aw-record-invoice'}`}>
                {row.kind === 'invoice' ? <FileText size={14} /> : row.kind === 'recurring service' ? <RefreshCw size={14} /> : <CalendarDays size={14} />}
              </span><span><strong>{row.ref}</strong><small>{row.kind}</small></span></div></td>
              <td><button className="aw-client-link" type="button" onClick={() => openClient(clientById.get(String(row.clientId)) || { id: row.clientId, name: row.name })} data-testid={`button-open-due-client-${row.id}`}>{row.name}</button></td>
              <td><StatusBadge value={row.status} testId={`status-due-work-${row.id}`} /></td>
              <td className="aw-align-right aw-amount">{row.amount == null ? <span className="aw-unpriced">Not priced</span> : currencyLabel(asNumber(row.amount), row.currency)}</td>
              <td className="aw-action-column">
                {row.kind === 'recurring service' && row.billable && <label className="aw-batch-select"><input type="checkbox" checked={batchSelection.includes(String(row.id))} onChange={() => toggleBatchService(row.id)} aria-label={`Select ${row.ref} for batch invoicing`} data-testid={`checkbox-batch-service-${row.id}`} /><span className="aw-visually-hidden">Select for invoicing</span></label>}
                {row.kind === 'recurring service' && row.billable
                  ? <button type="button" className="aw-row-action" onClick={() => openBatchReview([String(row.id)])} data-testid={`button-review-recurring-invoice-${row.id}`}>Review invoice</button>
                  : row.kind === 'invoice' && row.status === 'Overdue'
                    ? <button type="button" className="aw-row-action" onClick={() => openFollowup(row.clientId, row.name, row.invoice)} data-testid={`button-log-due-followup-${row.id}`}>Log follow-up</button>
                  : <button type="button" className="aw-row-action" onClick={() => openClient(clientById.get(String(row.clientId)) || { id: row.clientId, name: row.name })} data-testid={`button-open-due-ledger-${row.id}`}>Open ledger</button>}
              </td>
            </tr>)}</tbody>
          </table>
        </div> : <EmptyState title="No upcoming accounting work" detail="Open invoice balances, recurring services, and priced asset renewals will appear here when they are due within 30 days." />}
        {!loading && dueWorkRows.length > pageSize && <Pagination page={page} pageCount={pageCount} onPage={setPage} itemCount={dueWorkRows.length} />}
        {dueRecurringServices.length > 0 && <div className="aw-schedule-note"><Clock3 size={15} aria-hidden="true" /><span>Recurring invoices are created only after review and confirmation. A batch is all-or-nothing if any selected schedule has changed.</span></div>}
        <section className="aw-recent-followups" aria-label="Recent invoice follow-up history">
          <div className="aw-followup-history-heading"><div><h3>Recent follow-up history</h3><p>Saved contact notes only; no messages are sent from this history.</p></div><span>{overview.followups.length} logged</span></div>
          {loading ? <p className="aw-followup-empty">Loading follow-up history…</p> : overview.followups.length === 0
            ? <p className="aw-followup-empty">No follow-ups logged yet. Use “Log follow-up” on an overdue invoice to add the first record.</p>
            : <div className="aw-recent-followup-list">{overview.followups.slice(0, 6).map((item) => <article className="aw-recent-followup" key={item.id} data-testid={`row-recent-followup-${item.id}`}>
              <span className="aw-recent-followup-date">{dateLabel(item.contact_date)}</span>
              <div className="aw-recent-followup-main"><strong>{item.client_name || 'Client'} · {item.invoice_number || 'Invoice'}</strong>
                <span>{({ email: 'Email contact (logged only)', phone: 'Phone call', meeting: 'Meeting', other: 'Other' })[item.contact_method] || 'Contact'}</span>
                <p>{item.note}</p>
                {item.next_follow_up_date && <small>Next follow-up · {dateLabel(item.next_follow_up_date)}</small>}
              </div>
              <button type="button" className="aw-row-action" onClick={() => openClient(clientById.get(String(item.client_id)) || { id: item.client_id, name: item.client_name || 'Client' })} data-testid={`button-open-followup-client-${item.id}`}>Open ledger</button>
            </article>)}</div>}
        </section>
      </div>}

      {view === 'clients' && <div className="aw-panel">
        <div className="aw-section-heading"><div><h2>Client accounts</h2><p>Open a shared ledger to review and record client accounting.</p></div><span className="aw-count-label" data-testid="text-client-count">{matchingClients.length} matching clients</span></div>
        <div className="aw-client-tools">
          <div className="aw-search aw-client-search">
            <Search size={15} aria-hidden="true" />
            <input className="aw-search-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, company, email, or phone" aria-label="Search clients by name, company, email, or phone" data-testid="input-client-search" />
            {search && <button type="button" className="aw-search-clear" aria-label="Clear client search" onClick={() => setSearch('')} data-testid="button-clear-client-search"><X size={14} aria-hidden="true" /></button>}
          </div>
          <label className="aw-client-sort"><span>Sort</span><select value={clientSort} onChange={(event) => setClientSort(event.target.value)} aria-label="Sort client accounts" data-testid="select-client-sort">
            <option value="name">Name A–Z</option><option value="overdue">Most overdue</option><option value="open">Most open invoices</option>
          </select></label>
          <span className="aw-client-results" data-testid="text-client-results">{matchingClients.length} result{matchingClients.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? <LedgerSkeleton /> : matchingClients.length ? <>
          <div className="aw-client-table-wrap" role="region" tabIndex="0" aria-label="Client accounts table">
            <table className="aw-client-table">
              <thead><tr><th scope="col">Client</th><th scope="col">Contact</th><th scope="col">Status</th><th scope="col" className="aw-align-right">Open balance</th><th scope="col" className="aw-align-right">Open</th><th scope="col" className="aw-align-right">Overdue</th><th scope="col" className="aw-align-right">Schedules</th><th scope="col" className="aw-client-action-heading">Action</th></tr></thead>
              <tbody>{clientPageRows.map(({ client, openInvoices, overdueInvoices, clientServices }) => <tr key={client.id} data-testid={`row-client-${client.id}`}>
                <td><div className="aw-client-table-identity"><span className="aw-client-monogram" aria-hidden="true">{(client.name || client.company || 'C').trim().slice(0, 1).toUpperCase()}</span><span><strong data-testid={`text-client-name-${client.id}`}>{client.name || client.company || 'Unnamed client'}</strong><small>{client.company && client.company !== client.name ? client.company : 'Client account'}</small></span></div></td>
                <td className="aw-client-table-contact"><span>{client.email || 'No email on file'}</span>{client.phone && <small>{client.phone}</small>}</td>
                <td><StatusBadge value={client.status} testId={`status-client-${client.id}`} /></td>
                <td className="aw-align-right"><CurrencyAmounts rows={openInvoices} amountKey="balance_due" className="aw-client-currency" /></td>
                <td className="aw-align-right">{openInvoices.length}</td><td className="aw-align-right">{overdueInvoices.length}</td><td className="aw-align-right">{clientServices.length}</td>
                <td className="aw-client-action-cell"><button type="button" className="aw-row-action" data-testid={`button-manage-client-${client.id}`} onClick={() => openClient(client)}>Open ledger</button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="aw-client-grid">
            {clientPageRows.map(({ client, openInvoices, overdueInvoices, clientServices }) => <article className="aw-client-card" key={client.id} data-testid={`card-client-mobile-${client.id}`}>
              <div className="aw-client-card-head"><span className="aw-client-monogram" aria-hidden="true">{(client.name || client.company || 'C').trim().slice(0, 1).toUpperCase()}</span>
                <div className="aw-client-identity"><strong data-testid={`text-client-name-mobile-${client.id}`}>{client.name || client.company || 'Unnamed client'}</strong><span data-testid={`text-client-contact-mobile-${client.id}`}>{client.company && client.company !== client.name ? client.company : (client.email || 'No email on file')}</span>{client.phone && <small>{client.phone}</small>}</div>
                <StatusBadge value={client.status} testId={`status-client-mobile-${client.id}`} />
              </div>
              <div className="aw-client-facts">
                <span className="aw-client-balance"><small>Open balance</small><CurrencyAmounts rows={openInvoices} amountKey="balance_due" className="aw-client-currency" /></span>
                <span><small>Open invoices</small><strong>{openInvoices.length}</strong></span>
                <span><small>Overdue</small><strong>{overdueInvoices.length}</strong></span>
                <span><small>Active schedules</small><strong>{clientServices.length}</strong></span>
              </div>
              <button type="button" className="aw-button aw-button-open" data-testid={`button-manage-client-mobile-${client.id}`} onClick={() => openClient(client)}>Manage ledger <ChevronRight size={15} aria-hidden="true" /></button>
            </article>)}
          </div>
        </> : <EmptyState title={query ? 'No clients found' : 'No client accounts yet'} detail={query ? 'Try a different name, company, email, or phone number.' : 'Client accounting records will appear here when available.'} />}
        {!loading && matchingClients.length > pageSize && <Pagination page={page} pageCount={pageCount} onPage={setPage} itemCount={matchingClients.length} />}
      </div>}

      {view === 'services' && <div className="aw-panel">
        <div className="aw-section-heading"><div><h2>Recurring service schedule</h2><p>Scheduled services only. Invoices are created explicitly from a client ledger.</p></div><span className="aw-count-label" data-testid="text-service-count">{activeServices.length} active schedules</span></div>
        {loading ? <LedgerSkeleton /> : matchingServices.length ? <div className="aw-table-wrap">
          <table className="aw-table aw-service-table"><thead><tr><th scope="col">Service</th><th scope="col">Client</th><th scope="col">Frequency</th><th scope="col">Next due</th><th scope="col">Status</th><th scope="col" className="aw-align-right">Schedule amount</th><th scope="col" className="aw-action-column"><span className="aw-visually-hidden">Action</span></th></tr></thead>
            <tbody>{servicePageRows.map((row) => <tr key={row.id} data-testid={`row-service-${row.id}`}>
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
        {!loading && matchingServices.length > pageSize && <Pagination page={page} pageCount={pageCount} onPage={setPage} itemCount={matchingServices.length} />}
        <div className="aw-schedule-note"><Clock3 size={15} aria-hidden="true" /><span>A schedule tracks expected billing dates; it does not create an invoice or charge a client.</span></div>
        {(overview.hosting.length > 0 || overview.domains.length > 0) && <TrackedAssets hosting={overview.hosting} domains={overview.domains} clients={clientById} onOpen={openClient} />}
      </div>}
    </div>

    <footer className="aw-footer" data-testid="text-accounting-data-note"><span>Ledger source: recorded invoices and payments</span><span>Amounts remain grouped by currency</span></footer>

    {globalActionMode && <div className="aw-modal-backdrop aw-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGlobalActionMode(''); }}>
      <section className="aw-client-picker" role="dialog" aria-modal="true" aria-labelledby="aw-client-picker-title" data-testid="dialog-accounting-action-client">
        <header className="aw-client-picker-header">
          <div><span className="aw-drawer-kicker">ACCOUNTING ENTRY</span><h2 id="aw-client-picker-title">{globalActionMode === 'invoice' ? 'Choose a client for the invoice' : 'Choose a client for the payment'}</h2></div>
          <button ref={globalActionCloseRef} type="button" className="aw-icon-button aw-close-button" aria-label="Close client selector" onClick={() => setGlobalActionMode('')} data-testid="button-close-accounting-client-picker"><X size={18} /></button>
        </header>
        <p className="aw-picker-intro">You’ll review and save the entry in the client ledger. This does not send a message or charge a client.</p>
        <form onSubmit={continueGlobalAction}>
          <label>Client account<select required value={globalActionClientId} onChange={(event) => setGlobalActionClientId(event.target.value)} data-testid="select-global-action-client">
            <option value="">Select a client</option>
            {[...overview.clients].sort((a, b) => String(a.name || a.company || '').localeCompare(String(b.name || b.company || ''))).map((client) => <option key={client.id} value={String(client.id)}>{client.name || client.company || 'Unnamed client'}{client.company && client.name && client.company !== client.name ? ` · ${client.company}` : ''}</option>)}
          </select></label>
          <div className="aw-picker-actions">
            <button type="button" className="aw-button aw-button-quiet" onClick={() => setGlobalActionMode('')}>Cancel</button>
            <button type="submit" className="aw-button aw-button-primary" disabled={!globalActionClientId} data-testid="button-continue-global-accounting-action">Continue to {globalActionMode === 'invoice' ? 'invoice' : 'payment'} entry</button>
          </div>
        </form>
      </section>
    </div>}

    {batchReviewOpen && <div className="aw-modal-backdrop aw-batch-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !batchBusy) setBatchReviewOpen(false); }}>
      <section className="aw-batch-dialog" role="dialog" aria-modal="true" aria-labelledby="aw-batch-title" data-testid="dialog-recurring-batch-review">
        <header className="aw-batch-header">
          <div><span className="aw-drawer-kicker">RECURRING BILLING</span><h2 id="aw-batch-title">Review invoices before creating</h2></div>
          <button type="button" className="aw-icon-button" aria-label="Close batch review" onClick={() => !batchBusy && setBatchReviewOpen(false)} data-testid="button-close-batch-review"><X size={18} /></button>
        </header>
        <p className="aw-batch-intro">Only due schedules are available. Confirming creates one invoice per selected schedule and advances each billing date. Nothing is charged automatically.</p>
        <div className="aw-batch-list">
          {dueRecurringServices.map((row) => <label key={row.id} className="aw-batch-item" data-testid={`row-batch-review-${row.id}`}>
            <input type="checkbox" checked={batchSelection.includes(String(row.id))} onChange={() => toggleBatchService(row.id)} disabled={batchBusy} data-testid={`checkbox-review-batch-${row.id}`} />
            <span className="aw-batch-item-main"><strong>{row.service_name || row.service_type || 'Recurring service'}</strong><small>{row.client_name || clientById.get(String(row.client_id))?.name || 'Client'} · due {dateLabel(row.next_due_date)}</small></span>
            <span className="aw-batch-item-amount">{currencyLabel(asNumber(row.amount), row.currency || 'USD')}</span>
          </label>)}
        </div>
        <div className="aw-batch-total">
          <span>{selectedBatchServices.length} selected schedule{selectedBatchServices.length === 1 ? '' : 's'}</span>
          <div><span>Invoice totals:</span>{batchTotals.size
            ? [...batchTotals.entries()].map(([currency, amount]) => <strong key={currency}>{currencyLabel(amount, currency)}</strong>)
            : <strong>—</strong>}</div>
        </div>
        <div className="aw-batch-actions">
          <button type="button" className="aw-button aw-button-quiet" disabled={batchBusy} onClick={() => setBatchReviewOpen(false)}>Cancel</button>
          <button type="button" className="aw-button aw-button-primary" disabled={batchBusy || !selectedBatchServices.length} onClick={confirmBatchInvoice} data-testid="button-confirm-recurring-batch">
            {batchBusy ? 'Creating invoices…' : `Create ${selectedBatchServices.length} invoice${selectedBatchServices.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </div>}

    {followupTarget && <div className="aw-modal-backdrop aw-followup-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFollowupTarget(null); }}>
      <section className="aw-followup-dialog" role="dialog" aria-modal="true" aria-labelledby="aw-followup-dialog-title" data-testid="dialog-invoice-followup">
        <header className="aw-followup-dialog-header"><div><span className="aw-drawer-kicker">INTERNAL FOLLOW-UP</span><h2 id="aw-followup-dialog-title">Log invoice follow-up</h2></div>
          <button ref={followupCloseRef} type="button" className="aw-icon-button aw-close-button" aria-label="Close follow-up form" onClick={() => setFollowupTarget(null)} data-testid="button-close-followup-form"><X size={18} /></button>
        </header>
        <InvoiceFollowupForm clientId={followupTarget.clientId} clientName={followupTarget.clientName} invoice={followupTarget.invoice} onCancel={() => setFollowupTarget(null)} onSaved={finishFollowup} />
      </section>
    </div>}

    {activeClient && <div className="aw-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeClient(); }}>
      <section className="aw-drawer" role="dialog" aria-modal="true" aria-labelledby="aw-drawer-title" data-testid="dialog-client-accounting">
        <header className="aw-drawer-header"><div><span className="aw-drawer-kicker">CLIENT LEDGER</span><h2 id="aw-drawer-title">{activeClient.name || activeClient.company || 'Client accounting'}</h2>{activeClient.email && <p>{activeClient.email}</p>}{activeClient.phone && <p>{activeClient.phone}</p>}</div>
          <button ref={closeButtonRef} type="button" className="aw-icon-button aw-close-button" aria-label="Close client ledger" data-testid="button-close-client-ledger" onClick={closeClient}><X size={18} /></button>
        </header>
        <div className="aw-drawer-content"><ClientAccountingPanel clientId={activeClient.id} clientName={activeClient.name || activeClient.company || 'Client'} initialMode={activeClientMode} showNotification={notify} canEdit onSaved={() => refreshOverview({ silent: true })} /></div>
      </section>
    </div>}
  </section>;
}

function LedgerSkeleton() {
  return <div className="aw-skeleton-list" aria-label="Loading accounting records" data-testid="status-accounting-loading">
    {[0, 1, 2, 3].map((item) => <div className="aw-skeleton-row" key={item}><span /><span /><span /><span /></div>)}
  </div>;
}

function Pagination({ page, pageCount, onPage, itemCount }) {
  const start = itemCount ? ((page - 1) * 25) + 1 : 0;
  const end = Math.min(page * 25, itemCount);
  return <nav className="aw-pagination" aria-label="Accounting record pages" data-testid="nav-accounting-pagination">
    <span>{start}–{end} of {itemCount}</span>
    <div>
      <button type="button" className="aw-button aw-button-quiet" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous results page" data-testid="button-accounting-page-previous"><ChevronLeft size={14} />Previous</button>
      <span aria-live="polite">Page {page} of {pageCount}</span>
      <button type="button" className="aw-button aw-button-quiet" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Next results page" data-testid="button-accounting-page-next">Next<ChevronRight size={14} /></button>
    </div>
  </nav>;
}

function EmptyState({ title, detail }) {
  return <div className="aw-empty-state" data-testid="status-accounting-empty"><span className="aw-empty-rule" aria-hidden="true" /><strong>{title}</strong><p>{detail}</p></div>;
}

function TrackedAssets({ hosting, domains, clients, onOpen }) {
  return <section className="aw-assets"><div className="aw-section-heading"><div><h3>Hosting &amp; domain renewals</h3><p>Tracked client assets and renewal dates.</p></div></div>
    <div className="aw-assets-list">
      {hosting.map((row) => <article className="aw-asset-row" key={`hosting-${row.id}`} data-testid={`row-hosting-${row.id}`}>
        <span className="aw-asset-type">HOSTING</span><div className="aw-asset-main"><strong>{row.website_name || row.plan || 'Hosting plan'}</strong><small>{row.provider || 'Provider'} · {row.plan || row.billing_frequency || 'Plan not specified'}</small></div>
        <span className="aw-asset-date" data-testid={`text-hosting-renewal-${row.id}`}><strong>{dateLabel(row.renewal_date)}</strong><small>{asNumber(row.amount) > 0 ? `${currencyLabel(asNumber(row.amount), row.currency || 'USD')} · ${row.billing_frequency || 'recurring'}` : 'Not priced'}</small></span><StatusBadge value={row.status} testId={`status-hosting-${row.id}`} />
        <button type="button" className="aw-row-action" data-testid={`button-open-hosting-client-${row.id}`} onClick={() => onOpen(clients.get(String(row.client_id)) || { id: row.client_id, name: 'Client' })}>Open ledger</button>
      </article>)}
      {domains.map((row) => <article className="aw-asset-row" key={`domain-${row.id}`} data-testid={`row-domain-${row.id}`}>
        <span className="aw-asset-type aw-domain-type">DOMAIN</span><div className="aw-asset-main"><strong>{row.domain_name || 'Domain'}</strong><small>{row.registrar || 'Registrar not specified'}</small></div>
        <span className="aw-asset-date" data-testid={`text-domain-expiration-${row.id}`}><strong>{dateLabel(row.expiration_date)}</strong><small>{row.renewal_amount != null && asNumber(row.renewal_amount) > 0 ? `${currencyLabel(asNumber(row.renewal_amount), row.currency || 'USD')} · yearly` : 'Not priced'}</small></span><StatusBadge value={row.renewal_status} testId={`status-domain-${row.id}`} />
        <button type="button" className="aw-row-action" data-testid={`button-open-domain-client-${row.id}`} onClick={() => onOpen(clients.get(String(row.client_id)) || { id: row.client_id, name: 'Client' })}>Open ledger</button>
      </article>)}
    </div>
  </section>;
}