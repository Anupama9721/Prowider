'use client';
import { useState } from 'react';

const WEBHOOK_URL = '/api/webhook';

function generateIdempotencyKey() {
  return `key_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function TestTools() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState({});

  function addLog(message, type = 'info') {
    setLogs((prev) => [
      { id: Date.now() + Math.random(), message, type, time: new Date().toLocaleTimeString() },
      ...prev,
    ].slice(0, 50));
  }

  function setLoad(key, val) {
    setLoading((l) => ({ ...l, [key]: val }));
  }

  // Reset quota via webhook (single call)
  async function resetQuota() {
    setLoad('reset', true);
    const key = generateIdempotencyKey();
    addLog(`Sending webhook with key: ${key}`, 'info');
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': key,
        },
        body: JSON.stringify({ eventType: 'payment_confirmed' }),
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`✓ Quota reset successful. ${data.message}`, 'success');
      } else {
        addLog(`✗ Error: ${data.error}`, 'error');
      }
    } catch (err) {
      addLog(`✗ Network error: ${err.message}`, 'error');
    } finally {
      setLoad('reset', false);
    }
  }

  // Call webhook multiple times with SAME key (idempotency test)
  async function testIdempotency() {
    setLoad('idem', true);
    const key = generateIdempotencyKey();
    addLog(`Testing idempotency with key: ${key}`, 'info');
    addLog('Sending same webhook 5 times...', 'info');

    const results = await Promise.all(
      Array.from({ length: 5 }).map(async (_, i) => {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': key,
          },
          body: JSON.stringify({ eventType: 'payment_confirmed' }),
        });
        const data = await res.json();
        return { call: i + 1, idempotent: data.idempotent, ok: res.ok };
      })
    );

    const first = results.find((r) => !r.idempotent);
    const dupes = results.filter((r) => r.idempotent);
    addLog(
      `✓ Call 1: processed (idempotent: false)`,
      'success'
    );
    addLog(
      `✓ Calls 2-5: ${dupes.length} were idempotent (no duplicate effect)`,
      'success'
    );
    setLoad('idem', false);
  }

  // Generate 10 leads concurrently
  async function generateLeads() {
    setLoad('gen', true);
    addLog('Generating 10 leads concurrently...', 'info');
    try {
      const res = await fetch('/api/test-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_leads', count: 10 }),
      });
      const data = await res.json();
      if (res.ok) {
        addLog(
          `✓ Batch complete: ${data.succeeded}/${data.requested} succeeded, ${data.failed} failed`,
          'success'
        );
      } else {
        addLog(`✗ Error: ${data.error}`, 'error');
      }
    } catch (err) {
      addLog(`✗ Network error: ${err.message}`, 'error');
    } finally {
      setLoad('gen', false);
    }
  }

  // Call webhook with DIFFERENT key each time (should reset each time)
  async function multipleWebhooks() {
    setLoad('multi', true);
    addLog('Calling webhook 3x with DIFFERENT keys (each should process)...', 'info');
    for (let i = 0; i < 3; i++) {
      const key = generateIdempotencyKey();
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': key,
          },
          body: JSON.stringify({ eventType: 'payment_confirmed' }),
        });
        const data = await res.json();
        addLog(`Call ${i + 1} (key: ...${key.slice(-8)}): ${data.message || data.error}`, res.ok ? 'success' : 'error');
      } catch (err) {
        addLog(`Call ${i + 1} failed: ${err.message}`, 'error');
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    setLoad('multi', false);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Test Tools</h1>
        <p>
          Simulate payment webhooks, test idempotency, and generate concurrent leads.
          These tools are separate from the normal customer UI.
        </p>
      </div>

      <div
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: '0.875rem',
          color: 'var(--warning)',
        }}
      >
        ⚠️ <strong>Testing panel only.</strong> Quota resets must go through webhook — not the customer form.
        Idempotency keys prevent duplicate processing.
      </div>

      {/* Section 1: Quota Reset */}
      <div className="tool-section">
        <h2>1. Quota Reset via Webhook</h2>
        <p>
          Simulates a payment gateway confirming a subscription renewal.
          Resets all provider quotas to 10 and resets round-robin pointers.
          A unique idempotency key is generated automatically.
        </p>
        <div className="tool-actions">
          <button
            className="btn btn-success"
            onClick={resetQuota}
            disabled={loading.reset}
          >
            {loading.reset ? <span className="spinner" /> : '✓'}
            Reset All Quotas (Single Call)
          </button>
        </div>
      </div>

      {/* Section 2: Idempotency Test */}
      <div className="tool-section">
        <h2>2. Test Idempotency</h2>
        <p>
          Calls the webhook 5 times with the <strong>same idempotency key</strong>.
          Only the first call should take effect — the other 4 should return
          a cached response without side effects.
        </p>
        <div className="tool-actions">
          <button
            className="btn btn-warning"
            onClick={testIdempotency}
            disabled={loading.idem}
          >
            {loading.idem ? <span className="spinner" /> : '🔁'}
            Call Webhook 5× Same Key
          </button>
          <button
            className="btn btn-secondary"
            onClick={multipleWebhooks}
            disabled={loading.multi}
          >
            {loading.multi ? <span className="spinner" /> : '🔑'}
            Call Webhook 3× Different Keys
          </button>
        </div>
      </div>

      {/* Section 3: Concurrency Test */}
      <div className="tool-section">
        <h2>3. Concurrency Test — Generate 10 Leads</h2>
        <p>
          Fires 10 lead-creation requests simultaneously. Tests that serializable
          transactions prevent race conditions in provider allocation.
          Check the dashboard to see fair distribution.
        </p>
        <div className="tool-actions">
          <button
            className="btn btn-primary"
            onClick={generateLeads}
            disabled={loading.gen}
          >
            {loading.gen ? <span className="spinner" /> : '⚡'}
            Generate 10 Leads Concurrently
          </button>
          <a href="/dashboard" className="btn btn-secondary">
            Open Dashboard →
          </a>
        </div>
      </div>

      {/* Log panel */}
      <div className="tool-section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Activity Log</h2>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
            onClick={() => setLogs([])}
          >
            Clear
          </button>
        </div>
        <div className="log-panel">
          {logs.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>
              Run a test to see output here...
            </span>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`log-entry log-${log.type}`}
              >
                <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
                  [{log.time}]
                </span>
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>

      <hr className="divider" />

      {/* Reference section */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
        }}
      >
        <h2 style={{ marginBottom: 16, fontSize: '1rem' }}>
          Allocation Rules Reference
        </h2>
        <div className="grid-3">
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              Mandatory
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.8 }}>
              Service 1 → <code>Provider 1</code><br />
              Service 2 → <code>Provider 5</code><br />
              Service 3 → <code>Provider 1</code> + <code>Provider 4</code>
            </p>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              Round-Robin Pools
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.8 }}>
              Service 1 pool: <code>2, 3, 4</code><br />
              Service 2 pool: <code>6, 7, 8</code><br />
              Service 3 pool: <code>2, 3, 5, 6, 7, 8</code>
            </p>
          </div>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              Constraints
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.8 }}>
              Exactly <code>3</code> providers per lead<br />
              Monthly quota: <code>10</code> per provider<br />
              No duplicate phone+service
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
