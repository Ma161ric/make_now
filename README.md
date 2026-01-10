# 🎯 Make Now

> AI-powered day planner that transforms notes into structured daily plans

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Ready-orange.svg)](https://firebase.google.com/)
[![Production](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)]()

## 🌟 Vision

Make Now helps you capture thoughts effortlessly and turn them into actionable plans. Using AI-powered extraction and intelligent scheduling, it creates realistic daily plans that you can actually complete.

## ✨ Core Features

### 🎯 Production-Ready MVP

- **📝 Inbox Capture** – Write notes naturally, no forms or fields required
- **🤖 AI Extraction** – Groq-powered AI extracts tasks, events, and ideas automatically  
- **✅ Review & Confirm** – You stay in control—review and approve all suggestions
- **📅 Smart Planning** – AI generates focused daily plans: 1 major task + 2 small tasks
- **🔄 Real-time Sync** – Firebase-powered cloud sync across devices
- **🔐 Secure Auth** – Email, Google, and Apple sign-in with Firebase Authentication
- **🌓 Theme Support** – Beautiful light and dark modes
- **📱 Responsive** – Works seamlessly on desktop and mobile

### 🛡️ Security & Privacy

- **End-to-end Security** – Security headers, HTTPS enforcement, CSP
- **Privacy First** – GDPR-compliant data handling
- **Firestore Rules** – Robust security rules protecting user data
- **No Tracking** – We don't use third-party analytics or ad trackers

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Firebase CLI (`npm install -g firebase-tools`)
- Groq API key ([Get one free](https://console.groq.com/))

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Firebase and Groq credentials

# Start development server
npm run dev
```

### Development Commands

```bash
# Development
npm run dev              # Start dev server

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode

# Building
npm run build            # Build for production
npm run preview          # Preview production build

# Deployment
npm run deploy           # Deploy to Firebase
npm run deploy:hosting   # Deploy hosting only
npm run deploy:rules     # Deploy security rules only
```

## 📦 Project Structure

```
make_now/
├── apps/
│   └── web/                # Web application (Vite + React)
│       ├── src/
│       │   ├── screens/   # UI screens (Inbox, Today, Review)
│       │   └── ...
│       └── package.json
├── packages/
│   └── core/              # Core business logic
│       ├── src/
│       │   ├── models.ts      # Data models
│       │   ├── rules.ts       # Scheduling rules
│       │   ├── scheduling.ts  # Scheduling engine
│       │   ├── transitions.ts # State transitions
│       │   └── validation.ts  # Validation logic
│       └── test/
├── spec/                  # Product specifications
│   ├── 00_overview.md
│   ├── 10_features/
│   ├── 20_flows/
│   ├── 30_models/
│   ├── 40_rules/
│   ├── 50_ai/
│   ├── 60_integrations/
│   ├── 70_ui/
│   └── 80_quality/
└── adr/                   # Architecture Decision Records
```

## 🎯 MVP Features

### Core Functions

1. **📝 App Inbox** – Freeform text input directly in the app
2. **🔄 Note → Structure** – AI extracts tasks, events, ideas
3. **⏲️ Duration Estimation** – AI estimates duration ranges with confidence
4. **📅 Daily Plan** – 1 focus task + 2 mini tasks + buffer
5. **✅ One-Tap Confirm** – Creates Today list without calendar write
6. **🌙 Daily Review** – Evening review: done, postponed, or open

### Out of Scope (MVP)

- ❌ Calendar Write
- ❌ Recurring Tasks
- ❌ Team Features
- ❌ Multi-device Sync
- ❌ Widgets
- ❌ Wearable Support

## 🔮 Roadmap

### V1 Extensions
- 📆 Calendar Read-Only (auto-find free time slots)
- 🔄 Plan B Replan (reschedule remaining day)
- 💬 WhatsApp Ingest (WhatsApp → Inbox)
- 💬 WhatsApp Quick Replies (done, tomorrow, 30min, important)

### V2 Extensions
- ✏️ Calendar Write (auto-create time blocks)
- 🔁 Recurring Tasks (templates & repetitions)
- 🧠 Energy Mode Rules (Deep Work vs Admin time)

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Core Logic**: TypeScript (monorepo package)
- **Testing**: Vitest
- **Storage**: Local-first (browser storage)
- **Build Tool**: npm workspaces

## 📚 Documentation

- [Product Overview](spec/00_overview.md)
- [Features](spec/10_features/)
- [User Flows](spec/20_flows/)
- [Data Models](spec/30_models/)
- [Business Rules](spec/40_rules/)
- [AI Integration](spec/50_ai/)
- [Architecture Decisions](adr/)

## 🔒 Privacy & Security

- **Local-first**: All data stored locally
- **No secrets in client**: See [ADR-0003](adr/0003_no_secrets_in_client.md)
- **Privacy by design**: See [Privacy & Security](spec/80_quality/privacy_and_security.md)

## 🤝 Contributing

This is a private project. For questions or contributions, please contact the maintainer.

## 📄 License

Private - All rights reserved

---

Made with ❤️ for productive days