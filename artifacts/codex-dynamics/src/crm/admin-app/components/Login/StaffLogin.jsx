import React, { useState } from 'react';
import RoleLogin from './RoleLogin.jsx';
import { ROLE } from '../../shared';

export default function StaffLogin({ onAdminLogin }) {
  const [selectedRole, setSelectedRole] = useState(ROLE.SUPER_ADMIN);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--crm-bg)', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          padding: '16px 8px 0',
          background: 'var(--crm-bg)',
          flexWrap: 'wrap',
        }}
      >
        {[
          { role: ROLE.SUPER_ADMIN, label: 'Super Admin' },
          { role: ROLE.OFFICE_MANAGER, label: 'Office Manager' },
          { role: ROLE.TEAM_LEADER, label: 'Team Leader' },
          { role: ROLE.AGENT, label: 'Agent' },
        ].map((item) => (
          <button
            key={item.role}
            type="button"
            onClick={() => setSelectedRole(item.role)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: selectedRole === item.role ? '1px solid var(--crm-accent)' : '1px solid var(--crm-border)',
              background: selectedRole === item.role ? 'var(--crm-accent)' : 'var(--crm-card)',
              color: selectedRole === item.role ? '#181A20' : 'var(--crm-text-primary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <RoleLogin role={selectedRole} onAdminLogin={onAdminLogin} />
    </div>
  );
}
