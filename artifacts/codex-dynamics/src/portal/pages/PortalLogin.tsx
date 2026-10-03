import React from 'react';
import { ClientLoginSplitView } from '@/components/ClientLoginSplitView';
import { smoothNavigate } from '@/lib/nav';

interface PortalLoginProps {
  onLoginSuccess: () => void;
}

export function PortalLogin({ onLoginSuccess }: PortalLoginProps) {
  return (
    <ClientLoginSplitView
      onClose={() => {
        smoothNavigate('/');
      }}
      onSuccess={onLoginSuccess}
    />
  );
}
