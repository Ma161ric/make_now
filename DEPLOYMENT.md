# Production Deployment Guide

## Prerequisites

1. **Firebase CLI installed:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase project configured:**
   - Create project at https://console.firebase.google.com
   - Enable Authentication (Email, Google, Apple)
   - Enable Firestore Database
   - Enable Hosting

3. **Environment Variables:**
   - Copy `.env.example` to `.env`
   - Fill in all Firebase configuration values
   - Add your Groq API key

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Deployment Steps

### 1. Login to Firebase

```bash
firebase login
```

### 2. Initialize Firebase (First time only)

```bash
firebase init
```

Select:
- ✅ Firestore
- ✅ Hosting

### 3. Build and Deploy

```bash
# Full deployment (hosting + rules)
npm run deploy

# Hosting only
npm run deploy:hosting

# Security rules only
npm run deploy:rules
```

### 4. Post-Deployment Checklist

- [ ] Test login/signup flow
- [ ] Verify Firebase Auth works
- [ ] Check Firestore security rules
- [ ] Test all protected routes
- [ ] Verify Groq API integration
- [ ] Check security headers (use securityheaders.com)
- [ ] Test on mobile devices
- [ ] Monitor Firebase Console for errors

## Environment Variables

### Required for Production

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Groq API (for AI features)
GROQ_API_KEY=your-groq-api-key

# Environment
VITE_ENV=production
```

## Security Checklist

- [x] Environment variables not hardcoded
- [x] Firebase config uses .env
- [x] Security headers configured
- [x] Firestore security rules deployed
- [x] HTTPS enforced
- [x] XSS protection enabled
- [x] CSRF protection via Firebase Auth
- [x] Error boundary for graceful failures
- [ ] Rate limiting on API calls (TODO: Add Cloud Function)
- [ ] Monitoring and logging (TODO: Add Sentry/LogRocket)

## Monitoring

### Firebase Console
- Monitor authentication activity
- Check Firestore usage
- Review hosting analytics

### Recommended Tools
- Google Analytics (optional)
- Sentry for error tracking
- LogRocket for session replay

## Rollback

If deployment fails:

```bash
# View deployment history
firebase hosting:channel:list

# Deploy previous version
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
```

## Performance Optimization

Current optimizations:
- Code splitting (Firebase, React vendors)
- Asset caching (1 year for immutable assets)
- Compression enabled
- Source maps disabled in production

## Cost Estimates

Based on Firebase pricing:

**100 active users/month:**
- Authentication: Free (< 1000 MAU)
- Firestore: ~$0.25
- Hosting: Free (< 10GB storage, < 360MB/day)
- **Total: < $1/month**

**1000 active users/month:**
- Authentication: ~$50
- Firestore: ~$3
- Hosting: Free
- **Total: ~$53/month**

## Support

For deployment issues:
- Check Firebase docs: https://firebase.google.com/docs
- Firebase support: https://firebase.google.com/support
- Groq API docs: https://console.groq.com/docs
