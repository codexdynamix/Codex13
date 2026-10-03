const TOKEN_KEY = "codex_client_token";
const USER_KEY = "codex_client_user";

const DEFAULT_CLIENT = {
  id: "usr_demo",
  name: "Alex Morgan",
  email: "client@codexdynamics.com",
  phone: "+1 (555) 234-5678",
  country: "United States",
  status: "Active",
};

let clientMessages = [
  {
    id: "msg_1",
    sender: "agent",
    text: "Welcome to your Codex Dynamics client workspace. Let us know how we can help with your project.",
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
  },
];

export function readClientToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearClientToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function authLogin(email, _password) {
  const cleanEmail = String(email || "client@codexdynamics.com").trim();
  const nameFromEmail = cleanEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  const user = {
    ...DEFAULT_CLIENT,
    email: cleanEmail,
    name: cleanEmail === DEFAULT_CLIENT.email ? DEFAULT_CLIENT.name : nameFromEmail || "Client",
  };
  try {
    localStorage.setItem(TOKEN_KEY, `tok_${Date.now()}`);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
  return user;
}

export async function authMe() {
  const token = readClientToken();
  if (!token) return null;
  return getStoredUser() || DEFAULT_CLIENT;
}

export async function getLead(leadId) {
  return {
    id: leadId,
    name: "Client Account",
    email: "client@codexdynamics.com",
    clientPassword: "client123",
  };
}

export async function getClientInvoices() {
  return {
    invoices: [
      {
        id: "inv_101",
        type: "Invoice Payment",
        description: "Web Platform Architecture & Retainer",
        amount: "$4,500.00",
        status: "Completed",
        createdAt: new Date(Date.now() - 86400_000 * 5).toISOString(),
      },
    ],
    total: 1,
  };
}

export async function getClientMessages() {
  return { messages: clientMessages };
}

export async function sendClientMessage(text) {
  const msg = {
    id: `msg_${Date.now()}`,
    sender: "client",
    text,
    message: text,
    createdAt: new Date().toISOString(),
  };
  clientMessages = [...clientMessages, msg];
  return { ok: true, message: msg };
}

export async function getClientWorkspace() {
  return {
    projects: [],
    services: ["Web Development", "Brand Identity", "CRM Infrastructure"],
  };
}

export async function requestClientService(payload) {
  return { ok: true, request: payload };
}
