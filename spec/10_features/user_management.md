# User Management & Authentication

## Übersicht

Spezifikation für User-Management nach Firebase-Integration. Behandelt Sign-up, Login, Passwordreset, Profile Management und Session Handling.

## 1. Sign-Up Flow

### Screen: Auth - Sign-Up

**Purpose**: Neuer Nutzer registriert sich

**Components**:
- Email input
- Password input (mit Strength Indicator)
- Confirm password input
- Terms & Privacy checkbox
- "Sign up" button
- Link: "Already have an account? Login"

**Validation**:
- Email: Valid email format
- Password: Min 8 chars, 1 uppercase, 1 number, 1 special char
- Passwords match

**Success Flow**:
1. User klickt "Sign up"
2. Firebase Auth.createUserWithEmailAndPassword()
3. Send verification email
4. Show "Check your email" screen
5. User öffnet Link in Email
6. Email verified
7. Redirect to Onboarding Screen

**Error Handling**:
- Email already registered → Show error, link to login
- Weak password → Show requirements
- Network error → Retry button

### Screen: Auth - Email Verification

**Purpose**: Bestätigung der Email-Adresse

**Components**:
- Message: "Verifizierungslink gesendet an {email}"
- "Link nicht erhalten?" button
- Counter: "Erneut senden in X Sekunden"

**Resend Flow**:
- Max 3 resends
- Cooldown 60 Sekunden zwischen Resends
- After 3rd resend: "Kontaktieren Sie uns" link

## 2. Login Flow

### Screen: Auth - Login

**Purpose**: Bestehendes Konto einloggen

**Components**:
- Email input
- Password input
- "Login" button
- Links:
  - "Passwort vergessen?"
  - "Kein Konto? Jetzt registrieren"
- OR divider
- "Sign in with Google" button
- "Sign in with Apple" button (iOS only)

**Validation**:
- Email: Required
- Password: Required

**Success Flow**:
1. Firebase Auth.signInWithEmailAndPassword()
2. Load real-time listeners
3. Sync cloud data to local storage
4. Redirect to Inbox or Today (if plan exists for today)

**Error Handling**:
- Email not found → Suggest sign-up
- Wrong password → Show error, offer password reset
- Email not verified → Suggest resend verification
- Account disabled → Support message

## 3. Password Reset

### Screen: Auth - Forgot Password

**Purpose**: Nutzer hat Passwort vergessen

**Components**:
- Email input
- "Reset Password" button
- Back link

**Flow**:
1. User enters email
2. Firebase Auth.sendPasswordResetEmail()
3. Show confirmation screen
4. User opens email link
5. Redirect to reset page
6. User enters new password
7. Firebase Auth.confirmPasswordReset()
8. Redirect to login

**Constraints**:
- Max 1 reset request per 1 hour (rate limiting)
- Reset link valid for 24 hours

## 4. Session Management

### Auto-Logout

```typescript
interface SessionConfig {
  inactivityTimeout: number;      // 30 minutes
  warningTime: number;            // 5 minutes before logout
  allowExtend: boolean;           // User can extend session
}
```

**Flow**:
1. User inactive for 25 minutes
2. Show warning dialog: "Sitzung läuft in 5 Minuten ab"
3. Options:
   - "Sitzung verlängern" → Reset timer
   - "Logout jetzt" → Sign out
4. No action after 5 min → Auto logout

### Session Persistence

```typescript
interface SessionData {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresAt: timestamp;
  created_at: timestamp;
}
```

**Stored in**: localStorage (encrypted if possible)

**On App Start**:
1. Check if valid session exists
2. If expired, refresh token
3. If refresh fails, force re-login
4. If valid, restore user state

## 5. User Profile Management

### Screen: Settings - Profile

**Purpose**: User-Profil bearbeiten

**Components**:
- Avatar (editable)
- Display name (editable)
- Email (read-only, with change option)
- Member since (read-only)
- Last sync (read-only)
- Delete account button (dangerous)

**Profile Update Flow**:
1. User edits name/avatar
2. Click "Speichern"
3. Update Firestore `/users/{uid}/profile`
4. Show success message
5. Update local storage

### Change Email

**Components**:
- Current email (read-only)
- New email input
- "Change Email" button

**Flow**:
1. User enters new email
2. Firebase Auth.updateEmail()
3. Send verification email to new address
4. Wait for confirmation
5. Update Firestore

### Delete Account

**Dangerous Operation**: Requires confirmation

**Flow**:
1. Show warning: "Das Löschen ist permanent!"
2. Input email for confirmation
3. List consequences:
   - Alle Daten werden gelöscht
   - Keine Wiederherstellung möglich
4. Final "Jetzt löschen" button (red)
5. Call:
   - Firebase Auth.deleteUser()
   - Firestore: Delete `/users/{uid}/` collection
   - Cloud Functions: Cleanup (optional)
6. Redirect to login

## 6. Timezone & Language Settings

### Screen: Settings - Preferences

**Components**:
- Timezone selector
  - Current: Auto-detect via browser
  - Options: List of timezones (searchable)
- Language selector
  - Current: Auto-detect or browser setting
  - Options: [de, en] (expandable)
- Theme toggle (Light/Dark)
- Notifications toggle

**Storage**: `/users/{uid}/profile/preferences`

```typescript
interface UserPreferences {
  timezone: string;               // Europe/Berlin
  language: string;               // de, en
  theme: 'light' | 'dark';        // or 'system'
  notifications_enabled: boolean;
  sync_interval: number;          // 5, 10, 30, 60 min
  daily_review_reminder: string;  // 20:00
}
```

## 7. Device Management (V2)

### Screen: Settings - Devices

**Purpose**: Manage active sessions/devices

**Components**:
- List of active devices:
  - Device type (iPhone, Chrome, etc.)
  - Last active (timestamp)
  - IP address (last 3 octets masked)
  - "Sign out" button per device
- "Sign out all other devices" option

**Data**: Stored in Firestore `/users/{uid}/sessions/{sessionId}`

```typescript
interface Session {
  sessionId: string;
  device: string;           // iPhone, Chrome/Windows, etc.
  userAgent: string;
  ipAddress: string;        // masked
  created_at: timestamp;
  last_active_at: timestamp;
  is_current: boolean;
}
```

## 8. Security Considerations

### Password Requirements

```
✓ Minimum 8 characters
✓ At least 1 uppercase letter (A-Z)
✓ At least 1 lowercase letter (a-z)
✓ At least 1 number (0-9)
✓ At least 1 special character (!@#$%^&*)
✗ No more than 3 repeated characters
✗ No common passwords (checked against list)
```

### Rate Limiting

| Operation | Limit | Window |
|-----------|-------|--------|
| Sign-up attempts | 5 | 1 hour |
| Login attempts | 10 | 1 hour |
| Password reset | 1 | 1 hour |
| Email verification resend | 3 | 24 hours |

### Token Security

- **ID Token**: 1 hour expiry
- **Refresh Token**: 30 days expiry
- **Storage**: localStorage (httpOnly not possible in SPAs)
- **Transmission**: HTTPS only
- **No Token in URL**: Always use headers

### Email Verification

- Required before full access
- Verified flag stored in Firestore
- Logic prevents unverified users from syncing

## 9. Multi-Device Sync Behavior

### Scenario 1: User on Phone & Laptop

```
Phone:
  - User adds task "Buy milk"
  - Stored locally + sent to Firebase
  
Laptop:
  - Real-time listener active
  - Receives update instantly
  - Shows "New task" notification
  
Both devices:
  - Task appears in list
  - Sync status: ✓ Synced
```

### Scenario 2: Offline Changes

```
Phone (offline):
  - User adds task "Call mom"
  - Stored locally only
  - Queued as pending change
  
Phone reconnects:
  - Pending change sent to Firebase
  - Updated_at = device timestamp
  
Laptop:
  - Listener receives update
  - Merges with local state
  - No conflict (device had data)
```

### Scenario 3: Simultaneous Edits

```
Phone:
  - User edits task title: "Buy milk today"
  - Updated_at = 14:35:22
  
Laptop:
  - User edits same task: "Buy 2L milk"
  - Updated_at = 14:35:18
  
Resolution:
  - Conflict detected (different updated_at)
  - Last-Write-Wins: Phone version wins (14:35:22 > 14:35:18)
  - Laptop receives update
  - Phone shows as active editor
```

## 10. Error Handling

### Network Errors

- No connection
- Slow connection
- Timeout (>10s)

**UI**: Gray banner "Syncing..." with progress

**Behavior**:
- Keep working offline
- Queue changes
- Retry on reconnect

### Authentication Errors

| Error | Message | Action |
|-------|---------|--------|
| Invalid credentials | "Email oder Passwort falsch" | Retry |
| User disabled | "Konto wurde deaktiviert" | Contact support |
| Token expired | "Sitzung abgelaufen" | Silent refresh, if fails: re-login |
| Session revoked | "Sie wurden abgemeldet" | Redirect to login |

### Sync Errors

- Quota exceeded → Show warning, disable new items
- Permission denied → Refresh auth, if fails: re-login
- Data corruption → Show warning, offer restore from backup

## 11. Onboarding After Sign-Up

### Screen: Welcome Screen

```
Title: "Willkommen zu DayFlow!"

Content:
- Welcome message
- 3 key features (Inbox, Plan, Review)
- "Los geht's" button

Purpose:
- Show value proposition
- Set timezone preference
- Set language preference
```

### Next Steps

1. Timezone setup screen
2. Calendar integration offer (optional)
3. First inbox note prompt
4. Redirect to app

## 12. Testing Checklist

### Authentication Tests
- [ ] Sign-up with valid email/password
- [ ] Email verification flow
- [ ] Login with correct credentials
- [ ] Login with wrong password
- [ ] Password reset flow
- [ ] Google sign-in
- [ ] Apple sign-in
- [ ] Session persistence
- [ ] Logout
- [ ] Auto-logout on inactivity

### Profile Management
- [ ] Update display name
- [ ] Update timezone
- [ ] Change language
- [ ] Toggle notifications
- [ ] Change password
- [ ] Delete account

### Multi-Device
- [ ] Real-time sync between devices
- [ ] Offline queueing
- [ ] Conflict resolution
- [ ] Session management on device list

### Security
- [ ] Password validation
- [ ] Rate limiting
- [ ] Token refresh
- [ ] HTTPS enforcement
- [ ] Email verification enforcement
