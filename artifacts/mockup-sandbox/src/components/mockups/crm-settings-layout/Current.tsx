import './_group.css';
import './admin.css';
import './SiteSettings.css';
// @ts-expect-error The extracted source stays JSX to preserve the original component unchanged.
import CrmSettingsTab from './CrmSettingsTab.jsx';

export function Current() {
  return <div className="crm-admin-app"><CrmSettingsTab showNotification={() => {}} /></div>;
}
