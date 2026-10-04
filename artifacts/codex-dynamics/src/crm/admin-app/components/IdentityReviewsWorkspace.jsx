import React, { useMemo, useState } from 'react';

const buttonBase = {
  minHeight: 34,
  padding: '7px 11px',
  border: '1px solid var(--crm-border, rgba(255,255,255,.14))',
  borderRadius: 6,
  background: 'var(--crm-card, #242426)',
  color: 'var(--crm-text-primary, #f5f5f7)',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const selectStyle = {
  width: '100%',
  minHeight: 38,
  padding: '9px 11px',
  border: '1px solid var(--crm-border, rgba(255,255,255,.14))',
  borderRadius: 7,
  background: 'var(--crm-input-bg, #1c1c1e)',
  color: 'var(--crm-text-primary, #f5f5f7)',
  font: 'inherit',
  fontSize: 13,
};

function handleDialogKeyDown(event, onClose, locked = false) {
  if (event.key === 'Escape' && !locked) {
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget.querySelector('[role="dialog"], [role="alertdialog"]');
  const focusable = [...(dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function ClientIdentity({ side, name, company, email, phone, clientId }) {
  return (
    <div style={{ minWidth: 0, padding: 14, border: '1px solid var(--crm-border, rgba(255,255,255,.13))', borderRadius: 8, background: 'color-mix(in srgb, var(--crm-bg, #1c1c1e) 60%, var(--crm-card, #242426))' }} data-testid={`identity-client-${side}-${clientId}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: 'var(--crm-text-muted, #929298)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Client {side}</span>
        <span style={{ color: 'var(--crm-text-muted, #929298)', fontFamily: 'var(--font-family-mono, monospace)', fontSize: 10 }} data-testid={`text-identity-client-id-${side}-${clientId}`}>ID {clientId}</span>
      </div>
      <h3 style={{ margin: '8px 0 2px', fontSize: 15 }} data-testid={`text-identity-client-name-${side}-${clientId}`}>{name || 'Unnamed client'}</h3>
      <p style={{ margin: 0, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12 }} data-testid={`text-identity-client-company-${side}-${clientId}`}>{company || 'Company not provided'}</p>
      <div style={{ display: 'grid', gap: 4, marginTop: 12, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 11 }}>
        <span style={{ overflowWrap: 'anywhere' }} data-testid={`text-identity-client-email-${side}-${clientId}`}>{email || 'Email not provided'}</span>
        <span data-testid={`text-identity-client-phone-${side}-${clientId}`}>{phone || 'Phone not provided'}</span>
      </div>
    </div>
  );
}

function MergeDialog({ review, busy, error, onClose, onConfirm }) {
  const [primaryClientId, setPrimaryClientId] = useState(String(review.client_id_a));
  const [acknowledged, setAcknowledged] = useState(false);
  const primaryIsA = String(primaryClientId) === String(review.client_id_a);
  const keptClient = primaryIsA
    ? { name: review.client_a_name, company: review.client_a_company, id: review.client_id_a }
    : { name: review.client_b_name, company: review.client_b_company, id: review.client_id_b };
  const mergedClient = primaryIsA
    ? { name: review.client_b_name, company: review.client_b_company, id: review.client_id_b }
    : { name: review.client_a_name, company: review.client_a_company, id: review.client_id_a };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
      onKeyDown={(event) => handleDialogKeyDown(event, onClose, busy)}
      style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,.7)' }}
      data-testid="overlay-identity-merge"
    >
      <section role="dialog" aria-modal="true" aria-labelledby="merge-identity-title" aria-describedby="merge-identity-description" style={{ width: 'min(540px, 100%)', maxHeight: 'min(90dvh, 760px)', overflowY: 'auto', padding: 22, border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 12, background: 'var(--crm-card, #242426)', color: 'var(--crm-text-primary, #f5f5f7)', boxShadow: '0 22px 70px rgba(0,0,0,.45)' }} data-testid={`dialog-merge-identity-${review.client_id_a}-${review.client_id_b}`}>
        <p style={{ margin: '0 0 4px', color: '#e7ad64', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>Sensitive account action</p>
        <h3 id="merge-identity-title" style={{ margin: 0, fontSize: 19 }}>Choose the Client record to keep</h3>
        <p id="merge-identity-description" style={{ margin: '7px 0 16px', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12, lineHeight: 1.5 }}>Confirming immediately merges the other Client into the selected primary record and moves related records. This cannot be undone here. If identifiers, portal accounts, or workspaces conflict, the server blocks the merge without changing data.</p>

        <label htmlFor="identity-primary-client" style={{ display: 'grid', gap: 6, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12, fontWeight: 600 }}>
          Primary Client record to keep
          <select id="identity-primary-client" autoFocus value={primaryClientId} onChange={(event) => setPrimaryClientId(event.target.value)} style={selectStyle} data-testid={`select-primary-client-${review.client_id_a}-${review.client_id_b}`}>
            <option value={String(review.client_id_a)}>Keep {review.client_a_name || 'Client A'} · ID {review.client_id_a}</option>
            <option value={String(review.client_id_b)}>Keep {review.client_b_name || 'Client B'} · ID {review.client_id_b}</option>
          </select>
        </label>

        <div className="identity-merge-summary" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, margin: '14px 0', padding: 12, border: '1px solid rgba(231,173,100,.3)', borderRadius: 8, background: 'rgba(231,173,100,.06)' }} data-testid={`summary-identity-merge-${review.client_id_a}-${review.client_id_b}`}>
          <div><span style={{ display: 'block', color: '#72d8af', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Keep</span><strong style={{ display: 'block', marginTop: 3, fontSize: 12 }}>{keptClient.name || 'Unnamed client'}</strong><span style={{ color: 'var(--crm-text-muted, #929298)', fontSize: 10 }}>ID {keptClient.id}{keptClient.company ? ` · ${keptClient.company}` : ''}</span></div>
          <span className="identity-merge-arrow" aria-hidden="true" style={{ color: '#e7ad64', fontSize: 17 }}>→</span>
          <div><span style={{ display: 'block', color: '#ff9a9a', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Merge into kept record</span><strong style={{ display: 'block', marginTop: 3, fontSize: 12 }}>{mergedClient.name || 'Unnamed client'}</strong><span style={{ color: 'var(--crm-text-muted, #929298)', fontSize: 10 }}>ID {mergedClient.id}{mergedClient.company ? ` · ${mergedClient.company}` : ''}</span></div>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12, lineHeight: 1.45, cursor: 'pointer' }}>
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} style={{ marginTop: 2, accentColor: 'var(--crm-accent, #0a84ff)' }} data-testid={`checkbox-confirm-identity-merge-${review.client_id_a}-${review.client_id_b}`} />
          <span>I reviewed both records and confirm {mergedClient.name || `Client ${mergedClient.id}`} should be merged into {keptClient.name || `Client ${keptClient.id}`}.</span>
        </label>

        {error && <p role="alert" style={{ margin: '12px 0 0', padding: '9px 10px', border: '1px solid rgba(246,70,93,.35)', borderRadius: 6, background: 'rgba(246,70,93,.08)', color: '#ff8d96', fontSize: 12 }} data-testid={`alert-identity-merge-error-${review.client_id_a}-${review.client_id_b}`}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" style={buttonBase} onClick={onClose} disabled={busy} data-testid={`button-cancel-identity-merge-${review.client_id_a}-${review.client_id_b}`}>Cancel</button>
          <button type="button" style={{ ...buttonBase, borderColor: 'rgba(231,173,100,.55)', background: 'rgba(231,173,100,.13)', color: '#f1c27e' }} onClick={() => onConfirm(primaryIsA ? review.client_id_a : review.client_id_b)} disabled={busy || !acknowledged} data-testid={`button-confirm-identity-merge-${review.client_id_a}-${review.client_id_b}`}>{busy ? 'Merging…' : 'Confirm merge'}</button>
        </div>
      </section>
    </div>
  );
}

export default function IdentityReviewsWorkspace({
  reviews = [],
  loading = false,
  error = '',
  onReload = () => {},
  onResolve = async () => {},
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mergeReview, setMergeReview] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [mergeError, setMergeError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const statuses = useMemo(() => [...new Set(reviews.map((review) => review.status).filter(Boolean))], [reviews]);
  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reviews.filter((review) => {
      if (statusFilter && review.status !== statusFilter) return false;
      if (!query) return true;
      return [
        review.client_a_name,
        review.client_a_company,
        review.client_a_email,
        review.client_a_phone,
        review.client_b_name,
        review.client_b_company,
        review.client_b_email,
        review.client_b_phone,
        review.reason,
        review.status,
        review.client_id_a,
        review.client_id_b,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [reviews, search, statusFilter]);

  const runResolve = async (review, decision, primaryClientId = null) => {
    const key = `${review.client_id_a}-${review.client_id_b}`;
    setBusyKey(key);
    setActionError('');
    setMergeError('');
    setNotice('');
    try {
      const result = await onResolve({ review, decision, primaryClientId });
      if (result === false || result?.ok === false || result?.success === false) {
        throw new Error(result?.error || 'The identity service did not confirm this resolution.');
      }
    } catch (reason) {
      const message = reason?.message || 'The identity review could not be resolved.';
      if (decision === 'merge') setMergeError(message);
      else setActionError(message);
      setNotice('');
      setBusyKey('');
      return;
    }
    setNotice(decision === 'merge'
      ? 'Merge request submitted. Checking the latest review data.'
      : 'Distinct-client decision submitted. Checking the latest review data.');
    if (decision === 'merge') setMergeReview(null);
    try {
      await onReload();
      setNotice('Refresh requested. This list remains sourced from the review data provided by the parent; a pair stays visible until updated data is supplied.');
    } catch (reason) {
      setActionError(`Resolution submitted, but the review queue could not be refreshed: ${reason?.message || 'Please try again.'}`);
    } finally {
      setBusyKey('');
    }
  };

  const activeReviewKey = mergeReview ? `${mergeReview.client_id_a}-${mergeReview.client_id_b}` : '';

  return (
    <section className="identity-reviews-workspace" aria-labelledby="identity-reviews-title" style={{ display: 'grid', gap: 16, color: 'var(--crm-text-primary, #f5f5f7)' }} data-testid="workspace-identity-reviews">
      <style>{`
        @media (max-width: 767px) {
          .identity-reviews-workspace .identity-reviews-summary,
          .identity-reviews-workspace .identity-review-toolbar { grid-template-columns: minmax(0, 1fr) !important; }
          .identity-reviews-workspace .identity-review-pair { grid-template-columns: minmax(0, 1fr) !important; }
          .identity-reviews-workspace .identity-review-pair-arrow { display: none; }
          .identity-reviews-workspace .identity-merge-summary { grid-template-columns: minmax(0, 1fr) !important; }
          .identity-reviews-workspace .identity-merge-arrow { justify-self: center; transform: rotate(90deg); }
        }
      `}</style>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 4px', color: '#e7ad64', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>Super Admin · Identity integrity</p>
          <h2 id="identity-reviews-title" style={{ margin: 0, fontSize: 22, letterSpacing: '-.03em' }}>Client identity reviews</h2>
          <p style={{ margin: '5px 0 0', maxWidth: 590, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12 }}>Review possible duplicate Client records. Resolve a pair as distinct or carefully merge one record into the other.</p>
        </div>
        <button type="button" style={buttonBase} onClick={onReload} disabled={loading || Boolean(busyKey)} data-testid="button-reload-identity-reviews">{loading ? 'Refreshing…' : 'Refresh queue'}</button>
      </header>

      <div className="identity-reviews-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 9 }} data-testid="summary-identity-reviews">
        <div style={{ padding: '12px 14px', border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 8, background: 'var(--crm-card, #242426)' }} data-testid="stat-identity-review-total"><span style={{ display: 'block', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>Review pairs</span><strong style={{ display: 'block', marginTop: 4, fontSize: 21 }}>{reviews.length}</strong></div>
        <div style={{ padding: '12px 14px', border: '1px solid rgba(231,173,100,.26)', borderRadius: 8, background: 'color-mix(in srgb, #e7ad64 5%, var(--crm-card, #242426))' }} data-testid="stat-identity-review-statuses"><span style={{ display: 'block', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>Statuses in queue</span><strong style={{ display: 'block', marginTop: 4, color: '#e7ad64', fontSize: 21 }}>{statuses.length}</strong></div>
      </div>

      {(error || actionError) && <div role="alert" style={{ padding: '10px 12px', border: '1px solid rgba(246,70,93,.35)', borderRadius: 7, background: 'rgba(246,70,93,.08)', color: '#ff8d96', fontSize: 12 }} data-testid="alert-identity-reviews-error">{actionError || error}</div>}
      {notice && <div role="status" style={{ padding: '10px 12px', border: '1px solid rgba(68,211,162,.3)', borderRadius: 7, background: 'rgba(68,211,162,.07)', color: '#72d8af', fontSize: 12 }} data-testid="status-identity-reviews-notice">{notice}</div>}

      <div className="identity-review-toolbar" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.4fr) minmax(160px, .7fr)', gap: 9, padding: 12, border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 9, background: 'var(--crm-card, #242426)' }}>
        <label htmlFor="identity-review-search" style={{ display: 'grid', gap: 5, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 11, fontWeight: 600 }}>Search pair details
          <input id="identity-review-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Client, email, company, reason, ID…" style={selectStyle} data-testid="input-search-identity-reviews" />
        </label>
        <label htmlFor="identity-review-status-filter" style={{ display: 'grid', gap: 5, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 11, fontWeight: 600 }}>Review status
          <select id="identity-review-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={selectStyle} data-testid="filter-identity-reviews-status">
            <option value="">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </div>

      {loading && <div aria-label="Loading identity reviews" aria-busy="true" style={{ display: 'grid', gap: 9 }} data-testid="loading-identity-reviews">{[0, 1].map((index) => <div key={index} style={{ height: 210, border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 9, background: 'linear-gradient(90deg, var(--crm-card, #242426), var(--crm-card-hover, #2c2c2e), var(--crm-card, #242426))', opacity: .65 }} data-testid={`skeleton-identity-review-${index}`} />)}</div>}

      {!loading && error && reviews.length === 0 && <div style={{ padding: '24px 22px', border: '1px solid rgba(246,70,93,.3)', borderRadius: 9, background: 'rgba(246,70,93,.05)', textAlign: 'center' }} data-testid="error-state-identity-reviews"><h3 style={{ margin: 0, fontSize: 15 }}>Reviews could not be loaded</h3><p style={{ margin: '6px 0 14px', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12 }}>{error}</p><button type="button" style={buttonBase} onClick={onReload} data-testid="button-retry-identity-reviews">Try again</button></div>}

      {!loading && !error && reviews.length === 0 && <div style={{ padding: '30px 22px', border: '1px dashed var(--crm-border, rgba(255,255,255,.2))', borderRadius: 10, textAlign: 'center', background: 'color-mix(in srgb, #e7ad64 4%, var(--crm-card, #242426))' }} data-testid="empty-identity-reviews">
        <span aria-hidden="true" style={{ display: 'block', width: 34, height: 34, margin: '0 auto 12px', border: '1px solid rgba(231,173,100,.45)', borderRadius: 50, color: '#e7ad64', lineHeight: '32px', fontSize: 17 }}>?</span>
        <h3 style={{ margin: 0, fontSize: 15 }}>No identity reviews waiting</h3>
        <p style={{ margin: '6px auto 0', maxWidth: 390, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12 }}>When a possible duplicate Client pair needs attention, it will appear here.</p>
      </div>}

      {!loading && reviews.length > 0 && filteredReviews.length === 0 && <div style={{ padding: 22, border: '1px dashed var(--crm-border, rgba(255,255,255,.2))', borderRadius: 9, color: 'var(--crm-text-secondary, #b0b0b5)', textAlign: 'center', fontSize: 13 }} data-testid="empty-filtered-identity-reviews">No reviews match your search or status filter.</div>}

      {!loading && filteredReviews.length > 0 && <div style={{ display: 'grid', gap: 10 }} data-testid="list-identity-reviews">
        {filteredReviews.map((review) => {
          const key = `${review.client_id_a}-${review.client_id_b}`;
          const busy = busyKey === key;
          return (
            <article key={key} style={{ padding: 16, border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 9, background: 'var(--crm-card, #242426)' }} data-testid={`card-identity-review-${review.client_id_a}-${review.client_id_b}`}>
              <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--crm-text-muted, #929298)', fontFamily: 'var(--font-family-mono, monospace)', fontSize: 10 }} data-testid={`text-identity-review-pair-${review.client_id_a}-${review.client_id_b}`}>PAIR {review.client_id_a} / {review.client_id_b}</span>
                  <span style={{ padding: '3px 8px', border: '1px solid rgba(231,173,100,.35)', borderRadius: 999, background: 'rgba(231,173,100,.08)', color: '#e7ad64', fontSize: 10, fontWeight: 700 }} data-testid={`status-identity-review-${review.client_id_a}-${review.client_id_b}`}>{review.status || 'Needs review'}</span>
                </div>
                <time dateTime={review.created_at || undefined} style={{ color: 'var(--crm-text-muted, #929298)', fontSize: 10 }} data-testid={`text-identity-review-created-${review.client_id_a}-${review.client_id_b}`}>{review.created_at ? new Date(review.created_at).toLocaleString() : 'Date unavailable'}</time>
              </header>

              <div className="identity-review-pair" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'stretch', gap: 10 }}>
                <ClientIdentity side="A" name={review.client_a_name} company={review.client_a_company} email={review.client_a_email} phone={review.client_a_phone} clientId={review.client_id_a} />
                <div className="identity-review-pair-arrow" aria-hidden="true" style={{ alignSelf: 'center', color: 'var(--crm-text-muted, #929298)', fontSize: 15 }}>↔</div>
                <ClientIdentity side="B" name={review.client_b_name} company={review.client_b_company} email={review.client_b_email} phone={review.client_b_phone} clientId={review.client_id_b} />
              </div>

              <div style={{ marginTop: 12, padding: '10px 12px', borderLeft: '2px solid color-mix(in srgb, var(--crm-accent, #0a84ff) 50%, transparent)', background: 'color-mix(in srgb, var(--crm-accent, #0a84ff) 5%, var(--crm-card, #242426))' }} data-testid={`text-identity-review-reason-${review.client_id_a}-${review.client_id_b}`}>
                <span style={{ display: 'block', marginBottom: 3, color: 'var(--crm-text-muted, #929298)', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Reason flagged</span>
                <span style={{ color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12, lineHeight: 1.45 }}>{review.reason || 'No reason supplied.'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
                <p style={{ margin: 0, color: 'var(--crm-text-muted, #929298)', fontSize: 10 }}>Resolve only after comparing the contact and company details above.</p>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...buttonBase, borderColor: 'rgba(68,211,162,.35)', color: '#72d8af' }} disabled={busy || Boolean(busyKey)} onClick={() => runResolve(review, 'distinct')} data-testid={`button-mark-distinct-${review.client_id_a}-${review.client_id_b}`}>{busy && !mergeReview ? 'Saving…' : 'Mark as distinct'}</button>
                  <button type="button" style={{ ...buttonBase, borderColor: 'rgba(231,173,100,.38)', color: '#f1c27e' }} disabled={busy || Boolean(busyKey)} onClick={() => { setMergeReview(review); setMergeError(''); }} data-testid={`button-start-merge-${review.client_id_a}-${review.client_id_b}`}>Review merge</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>}

      {mergeReview && <MergeDialog
        review={mergeReview}
        busy={busyKey === activeReviewKey}
        error={mergeError}
        onClose={() => { if (busyKey !== activeReviewKey) setMergeReview(null); }}
        onConfirm={(primaryClientId) => runResolve(mergeReview, 'merge', primaryClientId)}
      />}
    </section>
  );
}