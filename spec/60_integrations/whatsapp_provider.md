# WhatsApp Provider Integration

## Übersicht

Abstrakte Definition für WhatsApp Ingest und Reply Handling. Nicht an konkrete API gebunden, kann via WhatsApp Business API, Cloud API oder Bridge implementiert werden.

## Provider Interface

```typescript
interface WhatsAppProvider {
  connect(phoneNumber: string): Promise<VerificationResult>;
  verify(code: string): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  sendMessage(to: string, text: string): Promise<SendResult>;
  onMessageReceived(callback: (message: IncomingMessage) => void): void;
  getStatus(): ConnectionStatus;
}
```

## Connection Flow

### 1. Initiate Connection

```typescript
const result = await provider.connect("+491234567890");
// SMS sent with verification code
```

### 2. Verify Code

```typescript
const connection = await provider.verify("123456");
// Returns bot number: "+49xxx"
```

### 3. Store Connection

```typescript
const whatsappConnection = {
  phone_number: "+491234567890",
  bot_number: connection.botNumber,
  verified_at: new Date(),
  status: "active"
};
```

## Incoming Messages

### Message Model

```typescript
interface IncomingMessage {
  id: string;
  from: string; // Phone number
  text: string;
  timestamp: Date;
  type: "text" | "image" | "audio" | "video";
}
```

### Webhook Handler

```typescript
provider.onMessageReceived(async (message) => {
  // Rate limit check
  if (!await checkRateLimit(message.from)) {
    await provider.sendMessage(message.from, "Limit erreicht (50/Tag)");
    return;
  }
  
  // Type check
  if (message.type !== "text") {
    await provider.sendMessage(message.from, "Nur Text-Nachrichten bitte");
    return;
  }
  
  // Create InboxNote
  const note = await createInboxNote({
    raw_text: message.text,
    source: "whatsapp",
    metadata: {
      whatsapp_message_id: message.id,
      sender_phone: message.from,
      received_at: message.timestamp
    }
  });
  
  // Auto-Extract if enabled
  if (settings.autoExtraction) {
    const result = await extractItems(note);
    await sendConfirmation(message.from, result);
  } else {
    await provider.sendMessage(message.from, "Notiert ✓");
  }
});
```

## Outgoing Messages

### Confirmation Messages

```typescript
async function sendConfirmation(to: string, extractionResult: ExtractionResult) {
  const count = extractionResult.items.length;
  
  if (count === 0) {
    await provider.sendMessage(to, "Notiert, aber konnte nichts erkennen");
  } else if (extractionResult.overall_confidence < 0.5) {
    await provider.sendMessage(to, "Notiert, aber bitte nochmal prüfen 🔍");
  } else {
    const taskCount = extractionResult.items.filter(i => i.type === "task").length;
    const eventCount = extractionResult.items.filter(i => i.type === "event").length;
    
    const parts = [];
    if (taskCount > 0) parts.push(`${taskCount} Aufgaben`);
    if (eventCount > 0) parts.push(`${eventCount} Termin${eventCount > 1 ? 'e' : ''}`);
    
    await provider.sendMessage(to, `${parts.join(", ")} gespeichert ✓`);
  }
}
```

### Reply to Commands

```typescript
async function handleCommand(message: IncomingMessage) {
  const command = parseCommand(message.text);
  
  if (command.type === "done") {
    const task = await getLastOpenTask();
    if (task) {
      await markTaskDone(task.id);
      await provider.sendMessage(message.from, `Erledigt: ${task.title} ✓`);
    } else {
      await provider.sendMessage(message.from, "Keine offenen Aufgaben");
    }
  }
  
  // ... other commands
}
```

## Command Parsing

```typescript
interface Command {
  type: "done" | "postpone" | "duration" | "priority" | "unknown";
  value?: any;
}

function parseCommand(text: string): Command {
  const lower = text.toLowerCase().trim();
  
  // done
  if (["done", "erledigt", "fertig", "✓"].includes(lower)) {
    return {type: "done"};
  }
  
  // morgen
  if (["morgen", "tomorrow", "verschieben"].includes(lower)) {
    return {type: "postpone", value: "tomorrow"};
  }
  
  // Dauer
  const durationMatch = lower.match(/(\d+)\s*(min|h|stunden?)/);
  if (durationMatch) {
    const value = parseInt(durationMatch[1]);
    const unit = durationMatch[2];
    const minutes = unit === "h" || unit.includes("stund") ? value * 60 : value;
    return {type: "duration", value: minutes};
  }
  
  // wichtig
  if (["wichtig", "prio", "urgent", "high"].includes(lower)) {
    return {type: "priority", value: "high"};
  }
  
  return {type: "unknown"};
}
```

## Rate Limiting

```typescript
interface RateLimit {
  phone: string;
  count: number;
  reset_at: Date; // Midnight
}

async function checkRateLimit(phone: string): Promise<boolean> {
  const limit = await getRateLimit(phone);
  
  if (!limit) {
    await createRateLimit({
      phone,
      count: 1,
      reset_at: getNextMidnight()
    });
    return true;
  }
  
  if (limit.count >= 50) {
    return false; // Limit reached
  }
  
  await incrementRateLimit(phone);
  return true;
}
```

## Error Handling

### Webhook Failures

```typescript
// Retry logic
const MAX_RETRIES = 3;

async function processWebhook(message: IncomingMessage, retryCount = 0) {
  try {
    await handleIncomingMessage(message);
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
      await processWebhook(message, retryCount + 1);
    } else {
      await logError("Webhook failed after 3 retries", {message, error});
      // Message lost
    }
  }
}
```

### Send Failures

```typescript
async function sendWithRetry(to: string, text: string): Promise<void> {
  try {
    await provider.sendMessage(to, text);
  } catch (error) {
    if (error.code === "RATE_LIMIT") {
      await delay(1000);
      await provider.sendMessage(to, text); // Retry once
    } else {
      await logError("Failed to send message", {to, text, error});
      // Don't block workflow
    }
  }
}
```

## Security

- Verify sender phone number
- Rate limiting per phone
- No PII in logs (hash phone numbers)
- Secure storage of bot credentials

## Implementation Options

### Option A: WhatsApp Business API

- Official API
- Requires Business Account
- Verified number
- Cost per message

### Option B: WhatsApp Cloud API

- Free tier available
- Meta Developer Account
- Webhook setup

### Option C: Bridge Solution

- Open-source bridges (e.g., whatsapp-web.js)
- No official API
- Against ToS (risk)
- MVP fallback

## Testing

Mock Provider:

```typescript
class MockWhatsAppProvider implements WhatsAppProvider {
  async connect(phone: string) {
    return {success: true, botNumber: "+49123456789"};
  }
  
  async sendMessage(to: string, text: string) {
    console.log(`Mock send to ${to}: ${text}`);
    return {success: true};
  }
  
  onMessageReceived(callback) {
    // Trigger with test data
    callback({
      id: "mock_msg_1",
      from: "+491234567890",
      text: "Test message",
      timestamp: new Date(),
      type: "text"
    });
  }
}
```
