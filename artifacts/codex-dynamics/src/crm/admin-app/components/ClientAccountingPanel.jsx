import React, { useEffect, useMemo, useState } from 'react';
import {
  createClientRecurringService,
  getClientAccountingAdmin,
  updateClientAccountingAsset,
  invoiceClientRecurringService,
  saveClientAccountingRecord,
  voidClientAccountingPayment,
  updateClientRecurringService,
} from '../adminApi.js';
import InvoiceFollowupForm from './InvoiceFollowupForm.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const newLine = () => ({ description: '', service: 'Project creation', quantity: 1, unitPrice: 0 });
const newRecurringService = () => ({
  serviceName: '',
  serviceType: 'Hosting',
  description: '',
  amount: '',
  currency: 'USD',
  billingFrequency: 'Monthly',
  startDate: today(),
  nextDueDate: today(),
  status: 'Active',
});
const inputStyle = {
  boxSizing: 'border-box',
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--crm-border, #3b3d45)',
  borderRadius: 8,
  background: 'var(--crm-card, #23242a)',
  color: 'var(--crm-text-primary, #fff)',
  fontSize: 12,
};
const panelStyle = {
  padding: 17,
  border: '1px solid var(--crm-border, #3b3d45)',
  borderRadius: 12,
  background: 'var(--crm-card, #23242a)',
};

function normalizeInvoice(row) {
  let items = row.line_items || row.lineItems || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  return {
    ...row,
    lineItems: items,
    invoiceNumber: row.invoice_number || row.invoiceNumber,
    issueDate: row.issue_date || row.issueDate,
    dueDate: row.due_date || row.dueDate,
    amountPaid: Number(row.amount_paid ?? row.amountPaid ?? 0),
    balanceDue: Number(row.balance_due ?? row.balanceDue ?? 0),
    total: Number(row.total ?? 0),
    status: row.status || 'Pending',
    currency: row.currency || 'USD',
  };
}
function normalizeRecurringService(row) {
  return {
    ...row,
    serviceName: row.service_name || row.serviceName || '',
    serviceType: row.service_type || row.serviceType || 'Other',
    description: row.description || '',
    amount: Number(row.amount || 0),
    currency: row.currency || 'USD',
    billingFrequency: row.billing_frequency || row.billingFrequency || 'Monthly',
    startDate: dateInput(row.start_date || row.startDate, today()),
    nextDueDate: dateInput(row.next_due_date || row.nextDueDate, today()),
    status: row.status || 'Active',
  };
}
function normalizePayment(row) {
  return {
    ...row,
    receiptNumber: row.receipt_number || row.receiptNumber,
    paymentDate: row.payment_date || row.paymentDate,
    paymentMethod: row.payment_method || row.paymentMethod,
    transactionReference: row.transaction_reference || row.transactionReference,
    amount: Number(row.amount || 0),
    invoiceId: row.invoice_id || row.invoiceId || '',
    currency: row.currency || 'USD',
  };
}
function money(amount, currency = 'USD') {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount) || 0); }
  catch { return `${currency} ${(Number(amount) || 0).toFixed(2)}`; }
}
function monthlyEquivalent(amount, frequency = 'Monthly') {
  const value = Number(amount) || 0;
  const label = String(frequency || '').toLowerCase();
  if (/one.?time|once/.test(label)) return 0;
  if (/bi.?weekly/.test(label)) return value * 26 / 12;
  if (/semi.?monthly/.test(label)) return value * 2;
  if (/year|annual/.test(label)) return value / 12;
  if (/quarter/.test(label)) return value / 3;
  if (/week/.test(label)) return value * 52 / 12;
  return value;
}
function dateInput(value, fallback) {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
}

export default function ClientAccountingPanel({ clientId, clientName = '', showNotification, canEdit = true, onSaved, initialMode = '' }) {
  const [records, setRecords] = useState({ invoices: [], payments: [], recurringServices: [], hosting: [], domains: [], followups: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const [currency, setCurrency] = useState('USD');
  const [items, setItems] = useState([newLine()]);
  const [taxRate, setTaxRate] = useState(0);
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(dateInput(null, new Date(Date.now() + 14 * 86400000).toISOString()));
  const [invoiceStatus, setInvoiceStatus] = useState('Pending');
  const [payment, setPayment] = useState({ invoiceId: '', paymentDate: today(), amount: '', paymentMethod: 'Bank transfer', transactionReference: '', description: '' });
  const [serviceForm, setServiceForm] = useState(newRecurringService);
  const [editingServiceId, setEditingServiceId] = useState('');
  const [assetEditing, setAssetEditing] = useState(null);
  const [assetDraft, setAssetDraft] = useState({ amount: '', currency: 'USD' });
  const [voidingPayment, setVoidingPayment] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [followupInvoice, setFollowupInvoice] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getClientAccountingAdmin(clientId);
      setRecords({
        invoices: (result.invoices || []).map(normalizeInvoice),
        payments: (result.payments || []).map(normalizePayment),
        recurringServices: (result.recurringServices || []).map(normalizeRecurringService),
        hosting: result.hosting || [],
        domains: result.domains || [],
        followups: result.followups || [],
      });
    } catch (reason) {
      setError(reason?.message || 'Could not load client accounting.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setMode(initialMode || '');
    setFollowupInvoice(null);
    load();
  }, [clientId, initialMode]);

  const totals = useMemo(() => {
    const invoices = records.invoices.filter((invoice) => invoice.currency === currency);
    const payments = records.payments.filter((row) => row.currency === currency && ['completed', 'received', 'paid', 'partially paid'].includes(String(row.status || '').toLowerCase()));
    return {
      billed: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
      outstanding: invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      received: payments.reduce((sum, row) => sum + row.amount, 0),
      recurringMonthly: records.recurringServices
        .filter((service) => service.currency === currency && String(service.status || '').toLowerCase() === 'active')
        .reduce((sum, service) => sum + monthlyEquivalent(service.amount, service.billingFrequency), 0)
        + records.hosting.filter((row) => row.currency === currency && Number(row.amount) > 0 && String(row.status || '').toLowerCase() === 'active')
          .reduce((sum, row) => sum + monthlyEquivalent(row.amount, row.billing_frequency), 0)
        + records.domains.filter((row) => row.currency === currency && Number(row.renewal_amount) > 0 && !/expired|cancelled|inactive/i.test(String(row.renewal_status || '')))
          .reduce((sum, row) => sum + Number(row.renewal_amount) / 12, 0),
    };
  }, [records, currency]);

  const invoiceEstimate = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0), 0);
    const tax = subtotal * Math.max(0, Number(taxRate) || 0) / 100;
    return { subtotal, tax, total: subtotal + tax };
  }, [items, taxRate]);

  const updateItem = (index, key, value) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  };

  const createInvoice = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveClientAccountingRecord(clientId, { type: 'invoice', currency, issueDate, dueDate, taxRate, status: invoiceStatus, lineItems: items });
      setItems([newLine()]);
      setTaxRate(0);
      setMode('');
      await load();
      onSaved?.();
      showNotification?.('Invoice created. Its balance is ready for payment tracking.');
    } catch (reason) {
      setError(reason?.message || 'Could not create the invoice.');
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveClientAccountingRecord(clientId, { type: 'payment', ...payment, currency: selectedInvoice?.currency || currency, amount: Number(payment.amount) });
      setPayment({ invoiceId: '', paymentDate: today(), amount: '', paymentMethod: 'Bank transfer', transactionReference: '', description: '' });
      setMode('');
      await load();
      onSaved?.();
      showNotification?.('Payment recorded and receipt issued.');
    } catch (reason) {
      setError(reason?.message || 'Could not record the payment.');
    } finally {
      setBusy(false);
    }
  };

  const selectedInvoice = records.invoices.find((invoice) => invoice.id === payment.invoiceId);
  const startEditingService = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      serviceName: service.serviceName,
      serviceType: service.serviceType,
      description: service.description,
      amount: String(service.amount),
      currency: service.currency,
      billingFrequency: service.billingFrequency,
      startDate: service.startDate,
      nextDueDate: service.nextDueDate,
      status: service.status,
    });
    setMode('service');
  };
  const saveRecurringService = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { ...serviceForm, amount: Number(serviceForm.amount) };
      if (editingServiceId) await updateClientRecurringService(clientId, editingServiceId, payload);
      else await createClientRecurringService(clientId, payload);
      setServiceForm(newRecurringService());
      setEditingServiceId('');
      setMode('');
      await load();
      onSaved?.();
      showNotification?.(editingServiceId ? 'Recurring service updated.' : 'Recurring service added to the schedule.');
    } catch (reason) {
      setError(reason?.message || 'Could not save this recurring service.');
    } finally {
      setBusy(false);
    }
  };
  const updateRecurringStatus = async (service, status) => {
    setBusy(true);
    setError('');
    try {
      await updateClientRecurringService(clientId, service.id, {
        serviceName: service.serviceName,
        serviceType: service.serviceType,
        description: service.description,
        amount: service.amount,
        currency: service.currency,
        billingFrequency: service.billingFrequency,
        startDate: service.startDate,
        nextDueDate: service.nextDueDate,
        status,
      });
      await load();
      onSaved?.();
      showNotification?.(`Recurring service ${status.toLowerCase()}.`);
    } catch (reason) {
      setError(reason?.message || 'Could not update the recurring service.');
    } finally {
      setBusy(false);
    }
  };
  const createRecurringInvoice = async (service) => {
    setBusy(true);
    setError('');
    try {
      const result = await invoiceClientRecurringService(clientId, service.id);
      await load();
      onSaved?.();
      showNotification?.(`Invoice ${result.invoiceNumber || ''} created for ${service.serviceName}.`);
    } catch (reason) {
      setError(reason?.message || 'Could not invoice this recurring service.');
    } finally {
      setBusy(false);
    }
  };
  const startEditingAsset = (line) => {
    setAssetEditing(line);
    setAssetDraft({ amount: line.amount == null ? '' : String(line.amount), currency: line.currency || 'USD' });
  };
  const saveAssetPricing = async (event) => {
    event.preventDefault();
    if (!assetEditing) return;
    setBusy(true);
    setError('');
    try {
      const amount = assetDraft.amount.trim() === '' ? null : Number(assetDraft.amount);
      await updateClientAccountingAsset(clientId, assetEditing.assetType, assetEditing.id, {
        ...(assetEditing.assetType === 'hosting' ? { amount } : { renewalAmount: amount }),
        currency: assetDraft.currency,
      });
      setAssetEditing(null);
      await load();
      onSaved?.();
      showNotification?.('Renewal pricing saved.');
    } catch (reason) {
      setError(reason?.message || 'Could not save renewal pricing.');
    } finally {
      setBusy(false);
    }
  };
  const voidPayment = async (event) => {
    event.preventDefault();
    if (!voidingPayment) return;
    setBusy(true);
    setError('');
    try {
      await voidClientAccountingPayment(clientId, voidingPayment.id, voidReason);
      setVoidingPayment(null);
      setVoidReason('');
      await load();
      onSaved?.();
      showNotification?.('Payment receipt voided and audit record saved.');
    } catch (reason) {
      setError(reason?.message || 'Could not void this payment.');
    } finally {
      setBusy(false);
    }
  };
  const followupSaved = async () => {
    setFollowupInvoice(null);
    await load();
    await onSaved?.();
    showNotification?.('Follow-up saved to history. No email was sent.');
  };
  const serviceLines = [
    ...records.hosting.map((item) => ({ id: item.id, assetType: 'hosting', name: item.website_name || item.plan || 'Hosting', type: 'Hosting', detail: `${item.provider || 'Provider'} · ${item.billing_frequency || 'Recurring'} · ${item.status || 'Active'}`, amount: Number(item.amount || 0), currency: item.currency || 'USD', due: item.renewal_date })),
    ...records.domains.map((item) => ({ id: item.id, assetType: 'domain', name: item.domain_name || 'Domain', type: 'Domain', detail: `${item.registrar || 'Registrar'} · ${item.renewal_status || 'Active'}`, amount: item.renewal_amount == null ? null : Number(item.renewal_amount), currency: item.currency || 'USD', due: item.expiration_date })),
  ];

  return (
    <div style={{ display: 'grid', gap: 16, color: 'var(--crm-text-primary, #fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17 }}>Client accounting</h3>
          <p style={{ margin: '5px 0 0', color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>Invoices, payments, receipts, and tracked hosting/domain renewals for this client.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select aria-label="Accounting currency" style={{ ...inputStyle, width: 'auto' }} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {['USD', 'EUR', 'GBP', 'UAH'].map((value) => <option key={value}>{value}</option>)}
          </select>
          {canEdit ? <>
            <button type="button" className="aw-button aw-button-quiet" onClick={() => setMode(mode === 'invoice' ? '' : 'invoice')}>New invoice</button>
            <button type="button" className="aw-button aw-button-primary" onClick={() => setMode(mode === 'payment' ? '' : 'payment')}>Record payment</button>
          </> : <span style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>Read-only access</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[
          ['Invoiced', totals.billed],
          ['Received', totals.received],
          ['Outstanding', totals.outstanding],
        ].map(([label, value]) => (
          <div key={label} style={panelStyle}>
            <div style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label} · {currency}</div>
            <div style={{ marginTop: 8, fontSize: 21, fontWeight: 700 }}>{money(value, currency)}</div>
          </div>
        ))}
      </div>

      {error && <div role="alert" style={{ color: '#ff716b', fontSize: 12 }}>{error}</div>}

      {canEdit && followupInvoice && <div className="aw-followup-inline" data-testid="panel-followup-form">
        <div className="aw-followup-inline-heading"><h4>Log invoice follow-up</h4><button type="button" className="aw-button aw-button-quiet" onClick={() => setFollowupInvoice(null)}>Close</button></div>
        <InvoiceFollowupForm clientId={clientId} clientName={clientName} invoice={followupInvoice} onCancel={() => setFollowupInvoice(null)} onSaved={followupSaved} />
      </div>}

      {canEdit && mode === 'invoice' && (
        <form onSubmit={createInvoice} style={{ ...panelStyle, display: 'grid', gap: 13 }}>
          <h4 style={{ margin: 0 }}>Create client invoice</h4>
          {items.map((item, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, .8fr) minmax(160px, 1.6fr) 90px 120px auto', alignItems: 'end', gap: 9 }}>
              <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Service
                <select style={inputStyle} value={item.service} onChange={(e) => updateItem(index, 'service', e.target.value)}>
                  {['Project creation', 'Website creation', 'Hosting', 'Domain', 'Custom email', 'Site maintenance', 'Maintenance', 'Support', 'Other'].map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Description
                <input required style={inputStyle} value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Website build, annual hosting…" />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Qty
                <input required type="number" min="0.01" step="0.01" style={inputStyle} value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Unit price
                <input required type="number" min="0" step="0.01" style={inputStyle} value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} />
              </label>
              <button type="button" className="aw-row-action aw-item-remove" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, i) => i !== index))} aria-label="Remove invoice item">Remove</button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" className="aw-button aw-button-quiet" onClick={() => setItems((current) => [...current, newLine()])}>+ Add service</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>Tax %
              <input type="number" min="0" max="100" step="0.01" style={{ ...inputStyle, width: 90 }} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>Issue date
              <input type="date" style={{ ...inputStyle, width: 'auto' }} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>Due date
              <input type="date" style={{ ...inputStyle, width: 'auto' }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>Status
              <select style={{ ...inputStyle, width: 'auto' }} value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)}><option value="Pending">Pending · visible in portal</option><option value="Draft">Keep as draft</option></select>
            </label>
            <strong style={{ marginLeft: 'auto' }}>Total: {money(invoiceEstimate.total, currency)}</strong>
            <button className="aw-button aw-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Create invoice'}</button>
          </div>
          <p style={{ margin: 0, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>Pending invoices are visible in the client portal. Creating one does not send an email or charge the client.</p>
        </form>
      )}

      {canEdit && mode === 'payment' && (
        <form onSubmit={recordPayment} style={{ ...panelStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', alignItems: 'end', gap: 10 }}>
          <h4 style={{ gridColumn: '1 / -1', margin: 0 }}>Record a payment and issue a receipt</h4>
          <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Apply to invoice
            <select style={inputStyle} value={payment.invoiceId} onChange={(e) => {
              const invoice = records.invoices.find((row) => row.id === e.target.value);
              setPayment((current) => ({ ...current, invoiceId: e.target.value, amount: invoice ? String(invoice.balanceDue) : current.amount }));
              if (invoice) setCurrency(invoice.currency);
            }}>
              <option value="">Unallocated payment</option>
              {records.invoices.filter((invoice) => invoice.balanceDue > 0 && invoice.status !== 'Draft').map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {money(invoice.balanceDue, invoice.currency)} due</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Amount ({selectedInvoice?.currency || currency})
            <input required type="number" min="0.01" step="0.01" max={selectedInvoice ? selectedInvoice.balanceDue : undefined} style={inputStyle} value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Date received
            <input required type="date" style={inputStyle} value={payment.paymentDate} onChange={(e) => setPayment({ ...payment, paymentDate: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Method
            <select style={inputStyle} value={payment.paymentMethod} onChange={(e) => setPayment({ ...payment, paymentMethod: e.target.value })}>{['Bank transfer', 'Card', 'Cash', 'PayPal', 'Other'].map((name) => <option key={name}>{name}</option>)}</select>
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Reference
            <input style={inputStyle} value={payment.transactionReference} onChange={(e) => setPayment({ ...payment, transactionReference: e.target.value })} placeholder="Bank or transaction reference" />
          </label>
          <button className="aw-button aw-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Record & issue receipt'}</button>
          {selectedInvoice && <span style={{ gridColumn: '1 / -1', color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>Remaining after payment: {money(Math.max(0, selectedInvoice.balanceDue - (Number(payment.amount) || 0)), selectedInvoice.currency)}</span>}
        </form>
      )}

      {canEdit && voidingPayment && (
        <form onSubmit={voidPayment} style={{ ...panelStyle, display: 'grid', gap: 10, borderColor: 'rgba(211,139,120,.45)' }} data-testid="form-void-payment">
          <h4 style={{ margin: 0 }}>Void receipt {voidingPayment.receiptNumber || ''}</h4>
          <p style={{ margin: 0, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>
            The receipt will remain in the ledger. Its invoice balance will be recalculated and this reason will be recorded in the audit log.
          </p>
          <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Reason (required)
            <textarea required minLength={5} maxLength={500} rows={3} style={inputStyle} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Explain why this receipt should be voided" data-testid="input-payment-void-reason" />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="aw-button aw-button-quiet" disabled={busy} onClick={() => { setVoidingPayment(null); setVoidReason(''); }}>Cancel</button>
            <button className="aw-button aw-button-danger" disabled={busy || voidReason.trim().length < 5} data-testid="button-confirm-payment-void">{busy ? 'Saving…' : 'Void receipt'}</button>
          </div>
        </form>
      )}

      <div style={{ ...panelStyle, overflowX: 'auto' }}>
        <h4 style={{ margin: '0 0 12px' }}>Invoices</h4>
        <div className="aw-ledger-mobile-hint">Swipe horizontally to review all invoice columns.</div>
        {loading ? <p style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>Loading…</p> : records.invoices.length === 0 ? <p style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>No invoices yet. Create one to start tracking services, amounts, and due dates.</p> : (
          <div className="aw-ledger-detail-scroll" role="region" tabIndex="0" aria-label="Client invoice records. Scroll horizontally to review all columns.">
          <table className="aw-ledger-detail-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead><tr>{['Invoice', 'Services', 'Issued', 'Due', 'Total', 'Paid', 'Balance', 'Status', ...(canEdit ? ['Follow-up'] : [])].map((heading) => <th key={heading} style={{ padding: 9, color: 'var(--crm-text-secondary, #a1a1aa)', borderBottom: '1px solid var(--crm-border, #3b3d45)' }}>{heading}</th>)}</tr></thead>
            <tbody>{records.invoices.map((invoice) => (
              <tr key={invoice.id} style={{ borderBottom: '1px solid var(--crm-border, #3b3d45)' }}>
                <td style={{ padding: 9 }}>{invoice.invoiceNumber}</td><td style={{ padding: 9 }}>{invoice.lineItems.map((item) => item.service || item.description).join(', ') || 'Agency services'}</td>
                <td style={{ padding: 9 }}>{invoice.issueDate}</td><td style={{ padding: 9 }}>{invoice.dueDate}</td><td style={{ padding: 9 }}>{money(invoice.total, invoice.currency)}</td><td style={{ padding: 9 }}>{money(invoice.amountPaid, invoice.currency)}</td><td style={{ padding: 9 }}>{money(invoice.balanceDue, invoice.currency)}</td><td style={{ padding: 9 }}>{invoice.status}</td>
                {canEdit && <td style={{ padding: 9 }}>{invoice.balanceDue > 0 && String(invoice.status || '').toLowerCase() !== 'draft'
                  ? <button type="button" className="aw-row-action" onClick={() => setFollowupInvoice(invoice)} data-testid={`button-log-invoice-followup-${invoice.id}`}>Log follow-up</button>
                  : <span style={{ color: 'var(--crm-text-secondary, #a1a1aa)' }}>—</span>}</td>}
              </tr>
            ))}</tbody>
          </table>
          </div>
        )}
      </div>

      <div className="aw-followup-history" style={panelStyle} data-testid="panel-followup-history">
        <div className="aw-followup-history-heading"><div><h4>Invoice follow-up history</h4><p>Contact notes are internal records; they do not send messages.</p></div><span>{records.followups.length} logged</span></div>
        {loading ? <p className="aw-followup-empty">Loading follow-up history…</p> : records.followups.length === 0
          ? <p className="aw-followup-empty">No follow-ups have been logged for this client.</p>
          : <div className="aw-followup-list">{records.followups.map((row) => <article className="aw-followup-entry" key={row.id} data-testid={`row-invoice-followup-${row.id}`}>
            <div className="aw-followup-entry-meta"><strong>{row.invoice_number || 'Invoice'}</strong><span>{row.contact_date} · {{ email: 'Email contact (logged only)', phone: 'Phone call', meeting: 'Meeting', other: 'Other' }[row.contact_method] || 'Contact'}</span></div>
            <p>{row.note}</p>
            <div className="aw-followup-entry-footer"><span>{row.staff_name ? `Recorded by ${row.staff_name}` : 'Recorded by admin'}</span>{row.next_follow_up_date && <strong>Next follow-up · {row.next_follow_up_date}</strong>}</div>
          </article>)}</div>}
      </div>

      <div style={{ ...panelStyle, overflowX: 'auto' }}>
        <h4 style={{ margin: '0 0 12px' }}>Payment receipts</h4>
        <div className="aw-ledger-mobile-hint">Swipe horizontally to review all receipt columns.</div>
        {!loading && records.payments.length === 0 ? <p style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>No payments recorded yet.</p> : (
          <div className="aw-ledger-detail-scroll" role="region" tabIndex="0" aria-label="Client payment receipts. Scroll horizontally to review all columns.">
          <table className="aw-ledger-receipt-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead><tr>{['Receipt', 'Date', 'Linked invoice', 'Method', 'Reference', 'Amount', 'Status', ...(canEdit ? ['Action'] : [])].map((heading) => <th key={heading} style={{ padding: 9, color: 'var(--crm-text-secondary, #a1a1aa)', borderBottom: '1px solid var(--crm-border, #3b3d45)' }}>{heading}</th>)}</tr></thead>
            <tbody>{records.payments.map((row) => {
              const invoice = records.invoices.find((candidate) => candidate.id === row.invoiceId);
              const isVoided = String(row.status || '').toLowerCase() === 'voided';
              return <tr key={row.id} style={{ borderBottom: '1px solid var(--crm-border, #3b3d45)' }} data-testid={`row-payment-receipt-${row.id}`}>
                <td style={{ padding: 9 }}>{row.receiptNumber}</td><td style={{ padding: 9 }}>{row.paymentDate}</td><td style={{ padding: 9 }}>{invoice?.invoiceNumber || 'Unallocated'}</td><td style={{ padding: 9 }}>{row.paymentMethod || '—'}</td><td style={{ padding: 9 }}>{row.transactionReference || '—'}</td>
                <td style={{ padding: 9, textDecoration: isVoided ? 'line-through' : 'none' }}>{money(row.amount, invoice?.currency || row.currency || currency)}</td>
                <td style={{ padding: 9 }}>
                  <span style={{ color: isVoided ? '#dda18e' : 'var(--crm-text-primary, #fff)' }}>{row.status || 'Completed'}</span>
                  {isVoided && row.void_reason && <small style={{ display: 'block', maxWidth: 220, color: 'var(--crm-text-secondary, #a1a1aa)' }} title={row.void_reason}>Reason: {row.void_reason}</small>}
                  {isVoided && (row.voided_by || row.voided_at) && <small style={{ display: 'block', color: 'var(--crm-text-secondary, #a1a1aa)' }}>Audit: {row.voided_by || 'Admin'} · {row.voided_at || 'Date unavailable'}</small>}
                </td>
                {canEdit && <td style={{ padding: 9 }}>{!isVoided && ['completed', 'received', 'paid', 'partially paid'].includes(String(row.status || '').toLowerCase())
                  ? <button type="button" className="aw-row-action aw-item-remove" disabled={busy} onClick={() => { setVoidingPayment(row); setVoidReason(''); }} data-testid={`button-void-payment-${row.id}`}>Void</button>
                  : isVoided ? <span style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>Voided</span> : '—'}</td>}
              </tr>;
            })}</tbody>
          </table>
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h4 style={{ margin: '0 0 12px' }}>Tracked hosting and domain services</h4>
        {serviceLines.length === 0 ? <p style={{ margin: 0, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>No hosting plans or domains are linked yet. Add those in the client portal service setup; invoice them here as recurring or one-off items.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 9 }}>
            {serviceLines.map((line, index) => <div key={`${line.type}-${line.id || index}`} style={{ padding: 12, border: '1px solid var(--crm-border, #3b3d45)', borderRadius: 9 }} data-testid={`card-tracked-asset-${line.assetType}-${line.id}`}>
              <strong style={{ fontSize: 12 }}>{line.name}</strong><div style={{ marginTop: 4, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>{line.type} · {line.detail}</div>
              <div style={{ marginTop: 7, fontSize: 11 }}>{line.amount != null && line.amount > 0 ? `${money(line.amount, line.currency)} · ` : 'Not priced · '}Renewal {line.due || 'not set'}{line.type === 'Domain' && line.amount != null ? ' · annual' : ''}</div>
              {canEdit && <button type="button" className="aw-row-action aw-edit-renewal" onClick={() => startEditingAsset(line)} data-testid={`button-edit-renewal-${line.assetType}-${line.id}`}>{line.amount != null && line.amount > 0 ? 'Edit renewal price' : 'Add renewal price'}</button>}
            </div>)}
          </div>
        )}
      </div>

      {canEdit && assetEditing && (
        <form onSubmit={saveAssetPricing} style={{ ...panelStyle, display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(120px, .5fr) auto auto', alignItems: 'end', gap: 10 }} data-testid="form-asset-renewal-price">
          <h4 style={{ gridColumn: '1 / -1', margin: 0 }}>Renewal price · {assetEditing.name}</h4>
          <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Amount {assetEditing.assetType === 'domain' ? '(annual, blank = unpriced)' : '(blank not allowed)'}
            <input type="number" min={assetEditing.assetType === 'domain' ? '0' : '0'} step="0.01" style={inputStyle} value={assetDraft.amount} onChange={(event) => setAssetDraft((current) => ({ ...current, amount: event.target.value }))} placeholder={assetEditing.assetType === 'domain' ? 'Not priced' : '0.00'} data-testid="input-asset-renewal-amount" />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Currency
            <select style={inputStyle} value={assetDraft.currency} onChange={(event) => setAssetDraft((current) => ({ ...current, currency: event.target.value }))} data-testid="select-asset-renewal-currency">
              {[...new Set([assetDraft.currency, 'USD', 'EUR', 'GBP', 'UAH', 'CAD', 'AUD', 'CHF', 'PLN'].filter(Boolean))].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <button type="submit" className="aw-button aw-button-primary" disabled={busy || (assetEditing.assetType === 'hosting' && assetDraft.amount.trim() === '')} data-testid="button-save-renewal-price">{busy ? 'Saving…' : 'Save price'}</button>
          <button type="button" className="aw-button aw-button-quiet" disabled={busy} onClick={() => setAssetEditing(null)}>Cancel</button>
        </form>
      )}
    </div>
  );
}