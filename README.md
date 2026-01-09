# 🎯 DayFlow

> AI-powered day planner that transforms notes into structured daily plans

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Private-red.svg)]()

## 🌟 Vision

DayFlow is a mobile app that automatically creates structured tasks and event suggestions from freeform text notes, generating realistic daily plans. Write a quick note, the app suggests, you confirm.

## ✨ Core Principles

- **📥 Inbox First** – Everything starts as freeform text. No forms, no fields.
- **💡 Suggestions, Not Autopilot** – The app suggests, you confirm. No surprises.
- **⏱️ Minimal Scheduling** – 1 focus task (60-120 min) + 2 mini tasks (5-20 min) per day, plus buffer.
- **🤖 AI with Confidence** – When uncertain, the app asks one targeted question.
- **📖 MVP: Calendar Read-Only** – Optional calendar reading in V1. No calendar writing.
- **💬 WhatsApp Integration** – Optional in MVP, but cleanly specified for V1.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd make_now

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development

```bash
# Run development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build
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