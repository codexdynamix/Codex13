import React, { useEffect, useMemo, useState } from 'react';
import {
  createClientRecurringService,
  getClientAccountingAdmin,
  invoiceClientRecurringService,
  saveClientAccountingRecord,
  updateClientRecurringService,
} from '../adminApi.js';

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
function dateInput(value, fallback) {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
}

export default function ClientAccountingPanel({ clientId, showNotification, canEdit = true, onSaved }) {
  const [records, setRecords] = useState({ invoices: [], payments: [], recurringServices: [], hosting: [], domains: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [items, setItems] = useState([newLine()]);
  const [taxRate, setTaxRate] = useState(0);
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(dateInput(null, new Date(Date.now() + 14 * 86400000).toISOString()));
  const [invoiceStatus, setInvoiceStatus] = useState('Pending');
  const [payment, setPayment] = useState({ invoiceId: '', paymentDate: today(), amount: '', paymentMethod: 'Bank transfer', transactionReference: '', description: '' });
  const [serviceForm, setServiceForm] = useState(newRecurringService);
  const [editingServiceId, setEditingServiceId] = useState('');

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
      });
    } catch (reason) {
      setError(reason?.message || 'Could not load client accounting.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [clientId]);

  const totals = useMemo(() => {
    const invoices = records.invoices.filter((invoice) => invoice.currency === currency);
    const payments = records.payments.filter((row) => row.currency === currency);
    return {
      billed: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
      outstanding: invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      received: payments.reduce((sum, row) => sum + row.amount, 0),
      recurringMonthly: records.recurringServices
        .filter((service) => service.currency === currency && service.status === 'Active')
        .reduce((sum, service) => sum + service.amount / (service.billingFrequency === 'Yearly' ? 12 : 1), 0),
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
  const serviceLines = [
    ...records.hosting.map((item) => ({ name: item.website_name || item.plan || 'Hosting', type: 'Hosting', detail: `${item.provider || 'Provider'} · ${item.billing_frequency || 'Recurring'} · ${item.status || 'Active'}`, amount: Number(item.amount || 0), due: item.renewal_date })),
    ...records.domains.map((item) => ({ name: item.domain_name || 'Domain', type: 'Domain', detail: `${item.registrar || 'Registrar'} · ${item.renewal_status || 'Active'}`, amount: null, due: item.expiration_date })),
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
            <button type="button" onClick={() => setMode(mode === 'invoice' ? '' : 'invoice')} style={{ border: '1px solid var(--crm-border, #3b3d45)', borderRadius: 8, padding: '9px 12px', background: 'transparent', color: 'var(--crm-text-primary, #fff)', cursor: 'pointer' }}>New invoice</button>
            <button type="button" onClick={() => setMode(mode === 'payment' ? '' : 'payment')} style={{ border: 0, borderRadius: 8, padding: '9px 12px', background: '#0A84FF', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Record payment</button>
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

      {canEdit && mode === 'invoice' && (
        <form onSubmit={createInvoice} style={{ ...panelStyle, display: 'grid', gap: 13 }}>
          <h4 style={{ margin: 0 }}>Create client invoice</h4>
          {items.map((item, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, .8fr) minmax(160px, 1.6fr) 90px 120px auto', alignItems: 'end', gap: 9 }}>
              <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--crm-text-secondary, #a1a1aa)' }}>Service
                <select style={inputStyle} value={item.service} onChange={(e) => updateItem(index, 'service', e.target.value)}>
                  {['Project creation', 'Hosting', 'Domain', 'Maintenance', 'Other'].map((name) => <option key={name}>{name}</option>)}
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
              <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, i) => i !== index))} aria-label="Remove invoice item" style={{ border: 0, background: 'transparent', color: '#ff716b', cursor: 'pointer', padding: 10 }}>Remove</button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setItems((current) => [...current, newLine()])} style={{ border: '1px solid var(--crm-border, #3b3d45)', borderRadius: 8, padding: '8px 10px', background: 'transparent', color: 'var(--crm-text-primary, #fff)', cursor: 'pointer' }}>+ Add service</button>
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
              <select style={{ ...inputStyle, width: 'auto' }} value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)}><option value="Pending">Send to client</option><option value="Draft">Keep as draft</option></select>
            </label>
            <strong style={{ marginLeft: 'auto' }}>Total: {money(invoiceEstimate.total, currency)}</strong>
            <button disabled={busy} style={{ border: 0, borderRadius: 8, padding: '9px 14px', background: '#0A84FF', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Saving…' : 'Create invoice'}</button>
          </div>
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
          <button disabled={busy} style={{ border: 0, borderRadius: 8, padding: '10px 14px', background: '#0A84FF', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Saving…' : 'Record & issue receipt'}</button>
          {selectedInvoice && <span style={{ gridColumn: '1 / -1', color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>Remaining after payment: {money(Math.max(0, selectedInvoice.balanceDue - (Number(payment.amount) || 0)), selectedInvoice.currency)}</span>}
        </form>
      )}

      <div style={{ ...panelStyle, overflowX: 'auto' }}>
        <h4 style={{ margin: '0 0 12px' }}>Invoices</h4>
        {loading ? <p style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>Loading…</p> : records.invoices.length === 0 ? <p style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>No invoices yet. Create one to start tracking services, amounts, and due dates.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead><tr>{['Invoice', 'Services', 'Issued', 'Due', 'Total', 'Paid', 'Balance', 'Status'].map((heading) => <th key={heading} style={{ padding: 9, color: 'var(--crm-text-secondary, #a1a1aa)', borderBottom: '1px solid var(--crm-border, #3b3d45)' }}>{heading}</th>)}</tr></thead>
            <tbody>{records.invoices.map((invoice) => (
              <tr key={invoice.id} style={{ borderBottom: '1px solid var(--crm-border, #3b3d45)' }}>
                <td style={{ padding: 9 }}>{invoice.invoiceNumber}</td><td style={{ padding: 9 }}>{invoice.lineItems.map((item) => item.service || item.description).join(', ') || 'Agency services'}</td>
                <td style={{ padding: 9 }}>{invoice.issueDate}</td><td style={{ padding: 9 }}>{invoice.dueDate}</td><td style={{ padding: 9 }}>{money(invoice.total, invoice.currency)}</td><td style={{ padding: 9 }}>{money(invoice.amountPaid, invoice.currency)}</td><td style={{ padding: 9 }}>{money(invoice.balanceDue, invoice.currency)}</td><td style={{ padding: 9 }}>{invoice.status}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div style={{ ...panelStyle, overflowX: 'auto' }}>
        <h4 style={{ margin: '0 0 12px' }}>Payment receipts</h4>
        {!loading && records.payments.length === 0 ? <p style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>No payments recorded yet.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead><tr>{['Receipt', 'Date', 'Linked invoice', 'Method', 'Reference', 'Amount'].map((heading) => <th key={heading} style={{ padding: 9, color: 'var(--crm-text-secondary, #a1a1aa)', borderBottom: '1px solid var(--crm-border, #3b3d45)' }}>{heading}</th>)}</tr></thead>
            <tbody>{records.payments.map((row) => {
              const invoice = records.invoices.find((candidate) => candidate.id === row.invoiceId);
              return <tr key={row.id} style={{ borderBottom: '1px solid var(--crm-border, #3b3d45)' }}><td style={{ padding: 9 }}>{row.receiptNumber}</td><td style={{ padding: 9 }}>{row.paymentDate}</td><td style={{ padding: 9 }}>{invoice?.invoiceNumber || 'Unallocated'}</td><td style={{ padding: 9 }}>{row.paymentMethod || '—'}</td><td style={{ padding: 9 }}>{row.transactionReference || '—'}</td><td style={{ padding: 9 }}>{money(row.amount, invoice?.currency || row.currency || currency)}</td></tr>;
            })}</tbody>
          </table>
        )}
      </div>

      <div style={panelStyle}>
        <h4 style={{ margin: '0 0 12px' }}>Tracked hosting and domain services</h4>
        {serviceLines.length === 0 ? <p style={{ margin: 0, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>No hosting plans or domains are linked yet. Add those in the client portal service setup; invoice them here as recurring or one-off items.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 9 }}>
            {serviceLines.map((line, index) => <div key={`${line.type}-${index}`} style={{ padding: 12, border: '1px solid var(--crm-border, #3b3d45)', borderRadius: 9 }}>
              <strong style={{ fontSize: 12 }}>{line.name}</strong><div style={{ marginTop: 4, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>{line.type} · {line.detail}</div>
              <div style={{ marginTop: 7, fontSize: 11 }}>{line.amount != null ? `${money(line.amount, currency)} · renewal ` : 'Renewal '}{line.due || 'not set'}</div>
            </div>)}
          </div>
        )}
      </div>
    </div>
  );
}