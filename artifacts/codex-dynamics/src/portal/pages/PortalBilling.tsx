import React, { useState } from 'react';
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Printer,
  X,
  FileText,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { portalDb, type PortalClient, type ClientInvoice, type ClientPayment } from '../../services/portalDatabase';

interface PortalBillingProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}

export function PortalBilling({ client, onNavigate }: PortalBillingProps) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currency, setCurrency] = useState('USD');
  const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoice | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ClientPayment | null>(null);

  const invoices = portalDb.getInvoices(client.id);
  const payments = portalDb.getPayments(client.id);

  const paymentCurrency = (payment: ClientPayment) =>
    invoices.find((invoice) => invoice.id === payment.invoiceId)?.currency || payment.currency || 'USD';
  const currencies = [...new Set([
    ...invoices.map((invoice) => invoice.currency || 'USD'),
    ...payments.map(paymentCurrency),
  ])];
  const displayCurrency = currencies.includes(currency) ? currency : currencies[0] || currency;
  const formatMoney = (amount: number, code = displayCurrency) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(Number(amount) || 0);
    } catch {
      return `${code} ${(Number(amount) || 0).toFixed(2)}`;
    }
  };
  const displayedInvoices = invoices.filter((invoice) => (invoice.currency || 'USD') === displayCurrency);
  const totalInvoiced = displayedInvoices.reduce((sum, i) => sum + i.total, 0);
  const totalPaid = displayedInvoices.reduce((sum, i) => sum + i.amountPaid, 0) +
    payments.filter((payment) => !payment.invoiceId && paymentCurrency(payment) === displayCurrency).reduce((sum, payment) => sum + payment.amount, 0);
  const totalBalanceDue = displayedInvoices.reduce((sum, i) => sum + i.balanceDue, 0);

  const filteredInvoices = invoices.filter((i) => {
    if (statusFilter === 'all') return true;
    return i.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0071E3] mb-1">
            Financial Management
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Billing, Invoices &amp; Receipts
          </h1>
          <p className="text-sm text-[#86868B] mt-1">
            Complete account balance, itemized invoices, and official payment receipts for <strong className="text-[#1D1D1F] dark:text-white font-medium">{client.company}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {currencies.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-[#86868B]">
              Currency
              <select value={displayCurrency} onChange={(event) => setCurrency(event.target.value)} className="rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C1C1E] px-3 py-2 text-xs text-[#1D1D1F] dark:text-white">
                {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
          )}
          <button
            onClick={() => onNavigate('/portal/support')}
            className="px-4 py-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold border border-black/[0.04] dark:border-white/[0.06] transition-all"
          >
            Billing Inquiry
          </button>
        </div>
      </div>

      {/* Financial Overview Cards - Apple Wallet Style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Outstanding Balance */}
        <div className="p-7 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <div className="text-xs text-[#86868B] font-medium uppercase tracking-wider">Outstanding Balance</div>
          <div className={`text-3xl sm:text-4xl font-semibold mt-3 font-mono tabular-nums tracking-tight ${totalBalanceDue > 0 ? 'text-[#B26A00] dark:text-[#FF9F0A]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}`}>
            {formatMoney(totalBalanceDue)}
          </div>
          <div className="text-xs text-[#86868B] mt-2">
            {totalBalanceDue > 0 ? 'Payment due via bank wire or credit card' : 'All accounts settled in full'}
          </div>
        </div>

        {/* Total Settled */}
        <div className="p-7 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <div className="text-xs text-[#86868B] font-medium uppercase tracking-wider">Total Settled to Date</div>
          <div className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-3 font-mono tabular-nums tracking-tight">
            {formatMoney(totalPaid)}
          </div>
          <div className="text-xs text-[#248A3D] dark:text-[#32D74B] mt-2 flex items-center gap-1.5 font-medium">
            <CheckCircle2 size={14} />
            <span>{payments.length} verified receipts issued</span>
          </div>
        </div>

        {/* Total Contract Volume */}
        <div className="p-7 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <div className="text-xs text-[#86868B] font-medium uppercase tracking-wider">Total Contract Volume</div>
          <div className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-3 font-mono tabular-nums tracking-tight">
            {formatMoney(totalInvoiced)}
          </div>
          <div className="text-xs text-[#86868B] mt-2">
            <span>{displayedInvoices.length} billing statements · {displayCurrency}</span>
          </div>
        </div>
      </div>

      {/* Segmented Control & Status Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Apple Segmented Tab Selector */}
        <div className="inline-flex p-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08] text-xs font-semibold self-start">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'invoices'
                ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'
            }`}
          >
            Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'payments'
                ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'
            }`}
          >
            Payment Receipts ({payments.length})
          </button>
        </div>

        {activeTab === 'invoices' && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {['all', 'paid', 'pending', 'overdue'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                  statusFilter === filter
                    ? 'bg-[#0071E3] text-white shadow-xs'
                    : 'bg-black/[0.04] dark:bg-white/[0.08] text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FBFBFC] dark:bg-[#252528] text-[#86868B] border-b border-black/[0.06] dark:border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-6">Invoice #</th>
                  <th className="py-4 px-6">Description</th>
                  <th className="py-4 px-6">Issued</th>
                  <th className="py-4 px-6">Due Date</th>
                  <th className="py-4 px-6 text-right">Total</th>
                  <th className="py-4 px-6 text-right">Balance Due</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#86868B]">
                      No invoices found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-6 font-mono font-semibold text-[#1D1D1F] dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-4 px-6 text-[#1D1D1F] dark:text-white font-medium max-w-xs truncate">
                        {inv.lineItems[0]?.description || 'Agency Services'}
                      </td>
                      <td className="py-4 px-6 text-[#86868B]">{inv.issueDate}</td>
                      <td className="py-4 px-6 text-[#86868B]">{inv.dueDate}</td>
                      <td className="py-4 px-6 text-right font-mono font-semibold text-[#1D1D1F] dark:text-white tabular-nums">
                        {formatMoney(inv.total, inv.currency || 'USD')}
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-semibold tabular-nums text-[#1D1D1F] dark:text-white">
                        {formatMoney(inv.balanceDue, inv.currency || 'USD')}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            inv.status === 'Paid'
                              ? 'bg-[#30D158]/10 text-[#248A3D] dark:text-[#32D74B]'
                              : inv.status === 'Pending'
                              ? 'bg-[#FF9F0A]/10 text-[#B26A00] dark:text-[#FF9F0A]'
                              : 'bg-[#FF3B30]/10 text-[#FF3B30]'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#0071E3] font-semibold text-xs transition-colors"
                        >
                          View &amp; Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FBFBFC] dark:bg-[#252528] text-[#86868B] border-b border-black/[0.06] dark:border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-6">Receipt #</th>
                  <th className="py-4 px-6">Payment Date</th>
                  <th className="py-4 px-6">Method</th>
                  <th className="py-4 px-6">Transaction Ref</th>
                  <th className="py-4 px-6 text-right">Amount Settled</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 font-mono font-semibold text-[#1D1D1F] dark:text-white">{p.receiptNumber}</td>
                    <td className="py-4 px-6 text-[#86868B]">{p.paymentDate}</td>
                    <td className="py-4 px-6 text-[#1D1D1F] dark:text-white font-medium">{p.paymentMethod}</td>
                    <td className="py-4 px-6 font-mono text-[11px] text-[#86868B]">{p.transactionReference}</td>
                    <td className="py-4 px-6 text-right font-mono font-semibold text-[#248A3D] dark:text-[#32D74B] tabular-nums">
                      {formatMoney(p.amount, paymentCurrency(p))}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedReceipt(p)}
                        className="px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#0071E3] font-semibold text-xs transition-colors"
                      >
                        Receipt Card
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Modal Simulation */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div>
                <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-white">
                  Invoice {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-[#86868B]">Official Billing Statement</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-black/[0.07]"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Invoice Sheet */}
            <div className="p-6 rounded-2xl bg-[#FBFBFC] dark:bg-[#252528] border border-black/[0.05] dark:border-white/[0.07] text-xs space-y-6 text-[#1D1D1F] dark:text-[#F5F5F7]">
              {/* Header Issuer / Recipient */}
              <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <div className="text-sm font-semibold text-[#1D1D1F] dark:text-white">Codex Dynamics Ltd.</div>
                  <div className="text-[#86868B] mt-0.5">High-Performance Web Architecture</div>
                  <div className="text-[#86868B]">London · Kyiv · New York</div>
                  <div className="text-[#86868B]">contact@codexdynamics.com</div>
                </div>

                <div className="sm:text-right">
                  <div className="text-[10px] uppercase font-semibold text-[#86868B]">Billed To</div>
                  <div className="text-sm font-semibold text-[#1D1D1F] dark:text-white mt-0.5">{client.company}</div>
                  <div className="text-[#86868B]">{client.name}</div>
                  <div className="text-[#86868B]">{client.address}</div>
                  <div className="text-[#86868B]">{client.email}</div>
                </div>
              </div>

              {/* Dates & Reference */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] text-xs">
                <div>
                  <div className="text-[#86868B]">Invoice Number:</div>
                  <div className="font-mono font-semibold text-[#1D1D1F] dark:text-white mt-0.5">{selectedInvoice.invoiceNumber}</div>
                </div>
                <div>
                  <div className="text-[#86868B]">Issue Date:</div>
                  <div className="font-medium text-[#1D1D1F] dark:text-white mt-0.5">{selectedInvoice.issueDate}</div>
                </div>
                <div>
                  <div className="text-[#86868B]">Due Date:</div>
                  <div className="font-medium text-[#1D1D1F] dark:text-white mt-0.5">{selectedInvoice.dueDate}</div>
                </div>
                <div>
                  <div className="text-[#86868B]">Status:</div>
                  <div className={`font-semibold mt-0.5 ${selectedInvoice.status === 'Paid' ? 'text-[#248A3D] dark:text-[#32D74B]' : 'text-[#B26A00] dark:text-[#FF9F0A]'}`}>
                    {selectedInvoice.status}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <table className="w-full text-left text-xs">
                  <thead className="text-[#86868B] border-b border-black/[0.06] dark:border-white/[0.08] text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5">Item Description</th>
                      <th className="py-2.5 text-center">Qty</th>
                      <th className="py-2.5 text-right">Unit Price</th>
                      <th className="py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                    {selectedInvoice.lineItems.map((li) => (
                      <tr key={li.id}>
                        <td className="py-3 text-[#1D1D1F] dark:text-white font-medium">{li.description}</td>
                        <td className="py-3 text-center text-[#86868B]">{li.quantity}</td>
                        <td className="py-3 text-right font-mono tabular-nums">{formatMoney(li.unitPrice, selectedInvoice.currency || 'USD')}</td>
                        <td className="py-3 text-right font-mono font-semibold text-[#1D1D1F] dark:text-white tabular-nums">{formatMoney(li.total, selectedInvoice.currency || 'USD')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] flex justify-end">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-[#86868B]">
                    <span>Subtotal:</span>
                    <span className="font-mono text-[#1D1D1F] dark:text-white">{formatMoney(selectedInvoice.subtotal, selectedInvoice.currency || 'USD')}</span>
                  </div>
                  <div className="flex justify-between text-[#86868B]">
                    <span>Tax (0% B2B):</span>
                    <span className="font-mono text-[#1D1D1F] dark:text-white">$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-[#1D1D1F] dark:text-white pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                    <span>Total Amount:</span>
                    <span className="font-mono text-[#0071E3]">{formatMoney(selectedInvoice.total, selectedInvoice.currency || 'USD')}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-[#248A3D] dark:text-[#32D74B]">
                    <span>Amount Paid:</span>
                    <span className="font-mono">{formatMoney(selectedInvoice.amountPaid, selectedInvoice.currency || 'USD')}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-[#B26A00] dark:text-[#FF9F0A] pt-1 border-t border-black/[0.06] dark:border-white/[0.08]">
                    <span>Balance Due:</span>
                    <span className="font-mono">{formatMoney(selectedInvoice.balanceDue, selectedInvoice.currency || 'USD')}</span>
                  </div>
                </div>
              </div>

              {/* Remittance Information */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] text-xs space-y-1">
                <div className="font-semibold text-[#1D1D1F] dark:text-white">Bank Remittance Instructions:</div>
                <div className="text-[#86868B]">Bank: Barclays Bank UK PLC · Sort Code: 20-00-00 · Account: 83920194</div>
                <div className="text-[#86868B]">SWIFT/BIC: BUKBGB22 · Reference: {selectedInvoice.invoiceNumber}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-[#30D158]/10 text-[#30D158] flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-white">Official Payment Receipt</h3>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#FBFBFC] dark:bg-[#252528] border border-black/[0.05] dark:border-white/[0.07] text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-[#86868B]">Receipt Number:</span>
                <span className="font-mono font-semibold text-[#248A3D] dark:text-[#32D74B]">{selectedReceipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868B]">Invoice Applied:</span>
                <span className="font-mono font-semibold text-[#1D1D1F] dark:text-white">{selectedReceipt.invoiceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868B]">Payment Date:</span>
                <span className="text-[#1D1D1F] dark:text-white font-medium">{selectedReceipt.paymentDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868B]">Payment Method:</span>
                <span className="text-[#1D1D1F] dark:text-white font-medium">{selectedReceipt.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868B]">Transaction Ref:</span>
                <span className="font-mono text-[11px] text-[#86868B]">{selectedReceipt.transactionReference}</span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08] text-sm font-semibold">
                <span className="text-[#1D1D1F] dark:text-white">Amount Confirmed:</span>
                <span className="text-[#248A3D] dark:text-[#32D74B] font-mono tabular-nums">{formatMoney(selectedReceipt.amount, paymentCurrency(selectedReceipt))}</span>
              </div>
            </div>

            <button
              onClick={() => { window.print(); setSelectedReceipt(null); }}
              className="w-full py-2.5 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold transition-all shadow-xs"
            >
              Print Official Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
