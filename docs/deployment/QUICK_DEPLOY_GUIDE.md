# 🚀 GitHub Actions Deployment - Quick Setup

## Schritt 1: GitHub Secrets konfigurieren

Gehe zu: **GitHub Repo → Settings → Secrets and variables → Actions**

Klicke auf **"New repository secret"** für jeden:

## Schritt 2: Firebase Service Account

### Option A: Automatisch (Einfachste!)
```bash
firebase login
firebase init hosting:github
# Folge den Prompts - wähle dein Repo
```

Das erstellt automatisch das Secret `FIREBASE_SERVICE_ACCOUNT`!

### Option B: Manuell
1. [Firebase Console](https://console.firebase.google.com/) öffnen
2. Projekt "make-now-3867c" auswählen
3. Settings ⚙️ → Service accounts
4. "Generate new private key" → Download JSON
5. Gesamten JSON-Inhalt kopieren
6. Als Secret `FIREBASE_SERVICE_ACCOUNT` hinzufügen

## Schritt 3: Deployen!

### Automatisch:
```bash
git add .
git commit -m "chore: setup GitHub Actions deployment"
git push origin main
```

Gehe zu: **GitHub → Actions** - siehst du das Deployment live! ✅

### Manuell triggern:
1. GitHub → Actions Tab
2. "Deploy to Firebase Hosting"
3. "Run workflow" → Run!

## Das war's! 🎉

Nach ~3-5 Minuten ist deine App live auf:
**https://make-now-3867c.web.app**

## 🔍 Troubleshooting

**Deployment fails?**
- Checke Actions Logs
- Alle Secrets korrekt?
- Firebase Service Account hat Permissions?

**Need help?**
Siehe [.github/DEPLOYMENT_GITHUB_ACTIONS.md](.github/DEPLOYMENT_GITHUB_ACTIONS.md) für Details
