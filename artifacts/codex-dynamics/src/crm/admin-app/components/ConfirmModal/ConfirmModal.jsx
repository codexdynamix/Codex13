import React, { useState, useRef, useCallback } from 'react';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.65)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  padding: 16,
};

const cardStyle = {
  background: 'var(--crm-card)',
  border: '1px solid var(--crm-border)',
  borderRadius: 12,
  padding: 24,
  width: '100%',
  maxWidth: 460,
  color: 'var(--crm-text-primary)',
  boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
  fontFamily: 'inherit',
};

const titleStyle = {
  margin: 0,
  marginBottom: 12,
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--crm-text-primary)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const messageStyle = {
  margin: 0,
  marginBottom: 20,
  fontSize: 14,
  lineHeight: 1.5,
  color: '#B7BDC6',
  whiteSpace: 'pre-line',
};

const footerStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
};

export function ConfirmModal({
  isOpen,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  isBusy = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const confirmClass = tone === 'danger' ? 'crm-modal-btn-danger' : 'crm-modal-btn-primary';
  const icon = tone === 'danger' ? 'Warning' : tone === 'warning' ? 'Warning' : null;

  const handleOverlayClick = () => {
    if (!isBusy && onCancel) onCancel();
  };

  return (
    <div
      style={overlayStyle}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crm-confirm-title"
    >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h3 id="crm-confirm-title" style={titleStyle}>
          {icon && <span aria-hidden="true">{icon}</span>}
          <span>{title}</span>
        </h3>
        <div style={messageStyle}>{message}</div>
        <div style={footerStyle}>
          <button
            type="button"
            className="crm-modal-btn-secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            disabled={isBusy}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirmDialog() {
  const [state, setState] = useState({
    isOpen: false,
    title: 'Confirm',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    tone: 'primary',
  });
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        isOpen: true,
        title: 'Confirm',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        tone: 'primary',
        ...opts,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
    if (resolverRef.current) {
      const r = resolverRef.current;
      resolverRef.current = null;
      r(true);
    }
  }, []);

  const handleCancel = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
    if (resolverRef.current) {
      const r = resolverRef.current;
      resolverRef.current = null;
      r(false);
    }
  }, []);

  const dialog = (
    <ConfirmModal
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      tone={state.tone}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return [dialog, confirm];
}

export default ConfirmModal;
