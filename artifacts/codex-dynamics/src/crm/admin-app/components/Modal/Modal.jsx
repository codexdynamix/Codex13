import React, { useEffect, useRef } from 'react';

const Modal = ({ isOpen, onClose, title, children, size }) => {
  const cardRef = useRef();

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (cardRef.current && !cardRef.current.contains(event.target)) {
      onClose();
    }
  };

  const sizeClass = size === 'large' ? 'crm-large-modal'
    : size === 'xl' ? 'crm-extra-large-modal'
    : '';

  return (
    <div
      className="crm-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crm-modal-title"
    >
      <div
        className={`crm-modal-content ${sizeClass}`.trim()}
        ref={cardRef}
      >
        <div className="crm-modal-header">
          <h3 id="crm-modal-title" className="crm-modal-title">{title}</h3>
          <button
            type="button"
            className="crm-modal-close-btn"
            onClick={onClose}
            title="Close (ESC)"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="crm-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
