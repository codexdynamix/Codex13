import React, { useState } from 'react';
import { saveClientInvoiceFollowup } from '../adminApi.js';

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatMoney = (amount, currency) => {
  const value = Number(amount) || 0;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
};

export default function InvoiceFollowupForm({ clientId, clientName = '', invoice, onCancel, onSaved }) {
  const [contactDate, setContactDate] = useState(localDate);
  const [contactMethod, setContactMethod] = useState('email');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveClientInvoiceFollowup(clientId, {
        invoiceId: invoice.id,
        contactDate,
        contactMethod,
        nextFollowUpDate,
        note: note.trim(),
      });
      onSaved?.();
    } catch (reason) {
      setError(reason?.message || 'Could not save the follow-up.');
    } finally {
      setBusy(false);
    }
  };

  return <form className="aw-followup-form" onSubmit={submit} data-testid="form-invoice-followup">
    <div className="aw-followup-context">
      <div><strong>{invoice.invoice_number || invoice.invoiceNumber || 'Invoice'}</strong><span>{invoice.client_name || invoice.clientName || clientName || 'Client'}</span></div>
      <strong>{formatMoney(invoice.balance_due ?? invoice.balanceDue ?? 0, invoice.currency || 'USD')}</strong>
    </div>
    <p className="aw-followup-note">Record a contact action only. Saving this will not send a message or charge the client.</p>
    <div className="aw-followup-fields">
      <label><span>Action date</span><input required type="date" value={contactDate} onChange={(event) => setContactDate(event.target.value)} data-testid="input-followup-date" /></label>
      <label><span>Contact method</span><select value={contactMethod} onChange={(event) => setContactMethod(event.target.value)} data-testid="select-followup-method">
        <option value="email">Email contact (logged only)</option>
        <option value="phone">Phone call</option>
        <option value="meeting">Meeting</option>
        <option value="other">Other</option>
      </select></label>
      <label><span>Next follow-up <small>(optional)</small></span><input type="date" min={contactDate || undefined} value={nextFollowUpDate} onChange={(event) => setNextFollowUpDate(event.target.value)} data-testid="input-next-followup-date" /></label>
    </div>
    <label className="aw-followup-message"><span>Notes</span><textarea required minLength={3} maxLength={2000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Summarize the response or agreed next step" data-testid="input-followup-note" /></label>
    {error && <p className="aw-followup-error" role="alert">{error}</p>}
    <div className="aw-followup-actions">
      {onCancel && <button type="button" className="aw-button aw-button-quiet" disabled={busy} onClick={onCancel}>Cancel</button>}
      <button type="submit" className="aw-button aw-button-primary" disabled={busy || note.trim().length < 3} data-testid="button-save-followup">{busy ? 'Saving…' : 'Save follow-up'}</button>
    </div>
  </form>;
}