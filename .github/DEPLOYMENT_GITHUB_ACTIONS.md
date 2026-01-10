# GitHub Actions Deployment Setup

## 🚀 Automatisches Deployment über GitHub Actions

Deine App deployed sich jetzt automatisch bei jedem Push auf `main`!

## 📋 Setup Schritte

### 1. Firebase Service Account erstellen

```bash
# Firebase CLI installieren (falls nicht vorhanden)
npm install -g firebase-tools

# Login
firebase login

# Service Account erstellen
firebase init hosting:github
```

**Oder manuell:**

1. Gehe zu [Firebase Console](https://console.firebase.google.com/)
2. Wähle dein Projekt
3. Settings → Service accounts
4. "Generate new private key"
5. JSON-Datei herunterladen

### 2. GitHub Secrets konfigurieren

Gehe zu deinem GitHub Repo → Settings → Secrets and variables → Actions → New repository secret

Füge folgende Secrets hinzu:

#### Firebase Secrets (aus deiner .env)
- `VITE_FIREBASE_API_KEY` = AIzaSyDQ3VjbMysjcqOV13JxYrtcSQ-9gTESGbA
- `VITE_FIREBASE_AUTH_DOMAIN` = make-now-3867c.firebaseapp.com
- `VITE_FIREBASE_PROJECT_ID` = make-now-3867c
- `VITE_FIREBASE_STORAGE_BUCKET` = make-now-3867c.firebasestorage.app
- `VITE_FIREBASE_MESSAGING_SENDER_ID` = 880850464950
- `VITE_FIREBASE_APP_ID` = 1:880850464950:web:9e678d5d5eaf6e911af617

#### Groq API Secret
- `GROQ_API_KEY` = [Dein Groq API Key aus .env]

#### Firebase Deployment Secrets
- `FIREBASE_SERVICE_ACCOUNT` = [Gesamter Inhalt der JSON-Datei von Schritt 1]
- `FIREBASE_TOKEN` = [Generiert mit `firebase login:ci`]

### 3. Deployment Token generieren

```bash
# Generiere Firebase CI Token
firebase login:ci

# Kopiere den Token und füge ihn als FIREBASE_TOKEN Secret hinzu
```

### 4. Fertig! 🎉

Jetzt passiert automatisch:

- **Bei Push auf main:** Build + Deploy zu Firebase Hosting
- **Bei Änderung der Firestore Rules:** Automatische Rule-Deployment
- **Manuell:** Über GitHub Actions Tab → "Run workflow"

## 🔍 Deployment Status prüfen

1. Gehe zu deinem GitHub Repo
2. Tab "Actions"
3. Siehst du alle Deployments und deren Status

## 🛠️ Workflows

### `deploy.yml` - Hauptdeployment
- Triggered bei: Push auf main, manuell
- Macht: Tests → Build → Deploy
- Dauer: ~3-5 Minuten

### `deploy-rules.yml` - Security Rules
- Triggered bei: Änderungen an firestore.rules
- Macht: Deploy nur die Rules
- Dauer: ~30 Sekunden

## 🚦 Manuelles Deployment

Falls du mal manuell deployen willst:

1. GitHub Repo → Actions
2. Workflow auswählen (z.B. "Deploy to Firebase Hosting")
3. "Run workflow" → Branch wählen → "Run workflow"

## ⚠️ Wichtig

- Secrets NIEMALS committen!
- `.env` ist in `.gitignore`
- Secrets werden nur in GitHub Actions verwendet
- Firebase Service Account ist sehr sensibel!

## 🔒 Security Best Practices

✅ Secrets nur in GitHub Secrets
✅ .env in .gitignore
✅ Service Account rotieren bei Leak
✅ Nur notwendige Permissions
✅ Branch Protection für main aktivieren

## 📝 Nächste Schritte

1. ✅ Secrets in GitHub konfigurieren
2. ✅ Firebase Service Account erstellen
3. ✅ Push auf main → Automatisches Deployment!
4. ✅ Firebase Hosting URL checken
5. ✅ Profit! 🎊

## 🌐 Deine App wird deployed zu:

- **Firebase Hosting:** https://make-now-3867c.web.app
- **Custom Domain:** (Optional konfigurierbar)

## 🆘 Troubleshooting

### Deployment failed?
- Check GitHub Actions Logs
- Verify all Secrets sind gesetzt
- Firebase Service Account hat permissions

### Tests failed?
- Lokale Tests laufen? `npm test`
- Dependencies aktuell? `npm ci`

### Build failed?
- .env Variablen korrekt?
- TypeScript Errors? `npm run build` lokal

---

**Happy Deploying! 🚀**
