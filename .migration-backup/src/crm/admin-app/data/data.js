import { DEFAULT_PLATFORM_SETTINGS } from '../../platformDefaults';

// --- Data ---
// Clients are managed through the CRM leads system (data.leads in App.jsx).
export const users = [];

// Activity log entries are generated from lead actions at runtime.
export const activityLog = [];

export const auditLog = [];

export const platformSettings = { ...DEFAULT_PLATFORM_SETTINGS };

export const createLogAdminAction = (setAuditLog) => (admin, action, details) => {
  const newLog = { admin, action, details, timestamp: new Date() };
  setAuditLog(prevLogs => [newLog, ...prevLogs]);
};

export const createLogActivity = (setActivityLog) => (userId, type, details) => {
  const newLog = { userId, type, details, timestamp: new Date() };
  setActivityLog(prevLogs => [newLog, ...prevLogs]);
};
