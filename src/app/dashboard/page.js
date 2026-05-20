'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

function QuotaBar({ received, quota }) {
  const pct = quota > 0 ? Math.min((received / quota) * 100, 100) : 0;
  const color =
    pct >= 100
      ? 'var(--danger)'
      : pct >= 70
      ? 'var(--warning)'
      : 'var(--success)';

  return (
    <div className="quota-bar-wrap">
      <div className="quota-bar-label">
        <span>Quota Usage</span>
        <span style={{ color }}>
          {received} / {quota}
        </span>
      </div>
      <div className="quota-bar">
        <div
          className="quota-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function Dashboard() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [highlightedProviders, setHighlightedProviders] = useState(new Set());
  const esRef = useRef(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      setProviders(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch providers', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up SSE
  useEffect(() => {
    fetchProviders();

    const es = new EventSource('/api/leads/stream');
    esRef.current = es;

    es.addEventListener('connected', () => setConnected(true));

    es.addEventListener('lead_assigned', (e) => {
      const data = JSON.parse(e.data);
      // Refresh provider data
      fetchProviders().then(() => {
        // Highlight affected providers
        if (data.providerIds) {
          const ids = new Set(data.providerIds);
          setHighlightedProviders(ids);
          setTimeout(() => setHighlightedProviders(new Set()), 3000);
        }
      });
    });

    es.addEventListener('quota_reset', () => {
      fetchProviders();
    });

    es.onerror = () => {
      setConnected(false);
      // Reconnection is automatic for EventSource
    };

    es.onopen = () => setConnected(true);

    return () => {
      es.close();
    };
  }, [fetchProviders]);

  const totalLeads = providers.reduce((s, p) => s + p.leadsReceived, 0);
  const totalRemaining = providers.reduce(
    (s, p) => s + Math.max(0, p.monthlyQuota - p.leadsReceived),
    0
  );

  return (
    <div>
      <div className="page-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h1>Provider Dashboard</h1>
            <p>Real-time lead assignment overview</p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <span
              className={`realtime-dot ${connected ? '' : 'disconnected'}`}
            />
            {connected ? 'Live' : 'Reconnecting...'}
            {lastUpdate && (
              <span style={{ marginLeft: 8 }}>
                Updated {timeAgo(lastUpdate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-label">Total Providers</div>
          <div className="stat-value">{providers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Leads Assigned</div>
          <div className="stat-value">{totalLeads}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Remaining Quota</div>
          <div className="stat-value">{totalRemaining}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Providers at Capacity</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {
              providers.filter((p) => p.leadsReceived >= p.monthlyQuota)
                .length
            }
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ width: 24, height: 24 }} />
          <p style={{ marginTop: 12 }}>Loading providers...</p>
        </div>
      ) : (
        <div className="grid-3">
          {providers.map((provider) => {
            const remaining = Math.max(
              0,
              provider.monthlyQuota - provider.leadsReceived
            );
            const isHighlighted = highlightedProviders.has(provider.id);
            const isFull = remaining === 0;

            return (
              <div
                key={provider.id}
                className={`provider-card ${isHighlighted ? 'new-lead' : ''}`}
              >
                <div className="provider-header">
                  <span className="provider-name">{provider.name}</span>
                  <span
                    className={`badge ${
                      isFull
                        ? 'badge-danger'
                        : remaining <= 3
                        ? 'badge-warning'
                        : 'badge-success'
                    }`}
                  >
                    {isFull ? 'Full' : `${remaining} left`}
                  </span>
                </div>
                <div className="provider-body">
                  <QuotaBar
                    received={provider.leadsReceived}
                    quota={provider.monthlyQuota}
                  />

                  {/* Lead list */}
                  <div style={{ marginTop: 16 }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font)',
                        letterSpacing: '0.08em',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                      }}
                    >
                      Recent Leads ({provider.leadAssignments.length})
                    </div>

                    {provider.leadAssignments.length === 0 ? (
                      <p
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.8rem',
                        }}
                      >
                        No leads yet
                      </p>
                    ) : (
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {provider.leadAssignments.slice(0, 20).map((a) => (
                          <div key={a.id} className="lead-item">
                            <div className="lead-meta">
                              <span className="lead-name">{a.lead.name}</span>
                              <span className="badge badge-accent">
                                {a.lead.service.name}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: 2,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {a.lead.city}
                              </span>
                              <span className="lead-time">
                                {timeAgo(a.assignedAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
