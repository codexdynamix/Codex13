export const createLogAdminAction = (setAuditLog) => (admin, action, details) => {
  const newLog = { admin, action, details, timestamp: new Date() };
  setAuditLog(prevLogs => [newLog, ...prevLogs]);
};

export const createLogActivity = (setActivityLog) => (userId, type, details) => {
  const newLog = { userId, type, details, timestamp: new Date() };
  setActivityLog(prevLogs => [newLog, ...prevLogs]);
};
