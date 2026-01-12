import { useState } from 'react';
import { extractFromNoteCloud } from '../firebase/functionsService';

export default function AITestScreen() {
  const [noteText, setNoteText] = useState('- Implement login\nTODO: Fix bug\n[ ] Review PR');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      console.log('[TEST] Calling AI with:', noteText);
      const response = await extractFromNoteCloud(noteText);
      console.log('[TEST] Raw response:', response);
      setResult(response);
    } catch (err: any) {
      console.error('[TEST] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 AI Extraction Test</h1>
      <p style={{ color: '#666' }}>Test the AI extraction API directly</p>

      <div style={{ marginBottom: '20px' }}>
        <label>Note Text:</label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          style={{
            width: '100%',
            height: '150px',
            padding: '10px',
            fontFamily: 'monospace',
            fontSize: '14px',
          }}
          placeholder="Enter note text to extract..."
        />
      </div>

      <button
        onClick={handleTest}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '⏳ Testing...' : '✨ Test AI Extraction'}
      </button>

      {error && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c33',
          }}
        >
          <strong>❌ Error:</strong>
          <pre style={{ margin: '10px 0', whiteSpace: 'pre-wrap' }}>{error}</pre>
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#efe',
            border: '1px solid #cfc',
            borderRadius: '4px',
          }}
        >
          <strong>✅ Result:</strong>
          <div style={{ marginTop: '10px' }}>
            <strong>Items ({result.items?.length || 0}):</strong>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
              {JSON.stringify(result.items, null, 2)}
            </pre>
          </div>
          <div style={{ marginTop: '10px' }}>
            <strong>Metadata:</strong>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
              {JSON.stringify(result.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div style={{ marginTop: '40px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>📋 How to use:</h3>
        <ol>
          <li>Enter a note in the text area above</li>
          <li>Click "Test AI Extraction"</li>
          <li>See the raw AI response below</li>
          <li>Check browser console (F12) for detailed logs</li>
          <li>Copy the JSON response and paste here to debug</li>
        </ol>
        <p style={{ color: '#666', marginTop: '10px' }}>
          <strong>Tip:</strong> Open DevTools (F12) → Console to see detailed [AI] and [TEST] logs
        </p>
      </div>
    </div>
  );
}
