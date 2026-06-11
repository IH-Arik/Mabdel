# Mabdel Website — React Web Application

<div align="center">

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Framer Motion](https://img.shields.io/badge/Framer%20Motion-11-FF0055?style=flat-square)](https://framer.com/motion)

</div>

The production-grade React web application for the Mabdel AI platform. A premium dark-mode SaaS dashboard with full feature parity with the mobile app.

---

## 🚀 Quick Start

```bash
npm install
cp .env.example .env.local      # set VITE_API_BASE_URL
npm run dev                     # http://localhost:5173
```

---

## 📁 Pages & Features

| Route | Page | Key Features |
|---|---|---|
| `/dashboard` | Dashboard | Stats, quick actions, recent activity |
| `/conversations` | Unified Inbox | Voice-to-text, AI replies, platform filter, archive |
| `/ai-workflow` | AI Workflow | Voice capture, GPT-4o, response history |
| `/contacts` | Contacts | CRM, import/export, segmentation |
| `/calls` | AI Calls | Analytics, transcripts, outbound AI caller |
| `/bulk-messaging` | Campaigns | 3-step wizard, CSV, scheduling |
| `/documents` | Document Studio | AI lease/agreement, PDF, sign, renew |
| `/invoices` | Invoices | Create, send, remind, PDF, track |
| `/calendar` | Calendar | Month/week/day, event CRUD |
| `/groups` | Groups | Chat workspaces, member management |
| `/integrations` | Integrations | WhatsApp, Telegram, Google, Meta, LinkedIn |
| `/notifications` | Notifications | Real-time alerts |
| `/settings` | Settings | Profile, business, subscription, security |
| `/shop` | Shop | Product catalog |
| `/activities` | Activities | Feed and community events |
| `/admin` | Admin Panel | User management, AI stats, reports |

---

## 🏗 Architecture

```
src/
├── api/
│   ├── client.js               # Axios + auth interceptors + refresh logic
│   └── services.js             # All API calls (smartflowApi, adminApi)
├── layouts/
│   └── MainLayout.jsx          # Persistent sidebar + top nav shell
├── pages/                      # One component per route
├── store/
│   └── useAuthStore.js         # Zustand: user session, token management
└── App.jsx                     # React Router v6 route tree
```

### API Service Pattern

All API calls are centralized in `services.js`:

```js
// Example usage in any component
import { smartflowApi } from '../api/services';

const res = await smartflowApi.getConversations();
const res = await smartflowApi.sendMessage({ conversation_id, content, platform });
const res = await smartflowApi.generateLease({ property_type, tenant_name, ... });
```

---

## 🎨 Design System

- **Color Palette**: Dark navy (`#0A1019`), Slate (`#131A24`), Cyan accent (`#11C7E5`)
- **Font**: System UI / Inter (via Tailwind)
- **Animations**: Framer Motion for all modals, drawers, and list transitions
- **Icons**: Lucide React (consistent 16/18/20px sizes)
- **Components**: All UI built in-place (no external component library dependency)

---

## 🛠 Available Scripts

```bash
npm run dev          # Development server with HMR
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run lint         # ESLint check
```

---

## 🌐 Environment Variables

```env
# .env.local
VITE_API_BASE_URL=http://localhost:8000
```

---

## 📦 Key Dependencies

| Package | Purpose |
|---|---|
| `react` + `react-dom` | UI rendering |
| `react-router-dom` | Client-side routing |
| `zustand` | Lightweight global state |
| `axios` | HTTP client with interceptors |
| `framer-motion` | Production-grade animations |
| `lucide-react` | Icon system |
| `date-fns` | Date formatting & calculation |
| `tailwindcss` | Utility-first styling |
