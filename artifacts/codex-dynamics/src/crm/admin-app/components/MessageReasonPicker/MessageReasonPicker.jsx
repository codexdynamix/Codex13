import React, { useState } from 'react';

export default function MessageReasonPicker({ catalog, categories, selectedCode, onSelect }) {
  const catList = categories || Object.keys(catalog || {});
  const [activeCategory, setActiveCategory] = useState(catList[0] || '');

  const reasons = (catalog && catalog[activeCategory]) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '10px 0' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {catList.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              background: activeCategory === cat ? 'color-mix(in srgb, var(--crm-accent) 15%, transparent)' : '#1E2329',
              color: activeCategory === cat ? 'var(--crm-accent)' : 'var(--crm-text-secondary)',
              border: `1px solid ${activeCategory === cat ? 'color-mix(in srgb, var(--crm-accent) 38%, transparent)' : '#2B3139'}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {reasons.map((r) => {
          const isSelected = selectedCode === r.code;
          return (
            <div
              key={r.code}
              onClick={() => onSelect && onSelect(r)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: isSelected ? 'color-mix(in srgb, var(--crm-accent) 10%, transparent)' : 'var(--crm-bg)',
                border: `1px solid ${isSelected ? 'color-mix(in srgb, var(--crm-accent) 50%, transparent)' : '#2B3139'}`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--crm-accent)' : 'var(--crm-text-primary)' }}>
                {r.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', lineHeight: 1.3 }}>
                {r.message}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
