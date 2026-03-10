// ============================================================
// config.js — Finance Tracker Configuration
// ============================================================
// Trage hier deine n8n-Webhook-URLs ein, bevor du deployest.
// ============================================================

const CONFIG = {
  // ----------------------------------------------------------
  // API Endpunkte (n8n Webhooks)
  // ----------------------------------------------------------
  API_GET_TRANSACTIONS: "https://n8n.srv1474416.hstgr.cloud/webhook/finance/get-transactions",
  API_ADD_TRANSACTION:  "https://n8n.srv1474416.hstgr.cloud/webhook/finance/add-transaction",
  API_GET_CATEGORIES:   "https://n8n.srv1474416.hstgr.cloud/webhook/finance/get-categories",
  API_ADD_CATEGORY:     "https://n8n.srv1474416.hstgr.cloud/webhook/finance/add-category",
  API_UPDATE_CATEGORY:  "https://n8n.srv1474416.hstgr.cloud/webhook/finance/update-category",
  API_DELETE_CATEGORY:  "https://n8n.srv1474416.hstgr.cloud/webhook/finance/delete-category",

  // ----------------------------------------------------------
  // Optionale Request-Headers (z.B. für n8n Basic Auth oder Token)
  // Auskommentieren und befüllen nach Bedarf.
  // ----------------------------------------------------------
  // API_HEADERS: {
  //   "Authorization": "Bearer YOUR_SECRET_TOKEN",
  //   "x-api-key": "YOUR_API_KEY"
  // },
  API_HEADERS: {
    "Content-Type": "application/json"
  },

  // ----------------------------------------------------------
  // Passwortschutz
  // ----------------------------------------------------------
  APP_PASSWORD: "2005",
  CACHE_KEY_AUTH: "ft_auth",

  // ----------------------------------------------------------
  // App-Defaults
  // ----------------------------------------------------------
  DEFAULT_THEME: "dark",                       // "dark" | "light"
  CACHE_KEY_TRANSACTIONS: "ft_transactions",
  CACHE_KEY_THEME:        "ft_theme",
  CACHE_KEY_MONTH:        "ft_month",

  // ----------------------------------------------------------
  // Kategorien mit Emoji-Icons
  // Ergänze oder ändere Einträge hier nach Bedarf.
  // ----------------------------------------------------------
  CATEGORIES: [
    { id: "food",        label: "Lebensmittel",  emoji: "🍔" },
    { id: "transport",   label: "Transport",     emoji: "🚗" },
    { id: "shopping",    label: "Shopping",      emoji: "🛒" },
    { id: "salary",      label: "Gehalt",        emoji: "💼" },
    { id: "health",      label: "Gesundheit",    emoji: "❤️" },
    { id: "home",        label: "Wohnen",        emoji: "🏠" },
    { id: "leisure",     label: "Freizeit",      emoji: "🎉" },
    { id: "education",   label: "Bildung",       emoji: "📚" },
    { id: "savings",     label: "Sparen",        emoji: "🏦" },
    { id: "other",       label: "Sonstiges",     emoji: "📋" }
  ]
};
