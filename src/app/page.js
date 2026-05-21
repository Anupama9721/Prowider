export default function Home() {
  return (
    <div>
      <div className="hero">
        <h1>
          Smart Lead<br />
          <span>Distribution</span>
        </h1>
        <p>
          Automatically allocate service leads to providers using mandatory rules,
          fair round-robin rotation, and real-time dashboard updates.
        </p>
        <div className="hero-actions">
          <a href="/request-service" className="btn btn-primary btn-lg">
            Submit a Lead
          </a>
          <a href="/dashboard" className="btn btn-secondary btn-lg">
            Provider Dashboard
          </a>
        </div>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">⚙️</div>
          <h3>Mandatory Assignment</h3>
          <p>
            Service 1 always goes to Provider 1. Service 2 → Provider 5.
            Service 3 → Providers 1 & 4. Rules enforced at DB level.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔄</div>
          <h3>Fair Round-Robin</h3>
          <p>
            Remaining slots distributed via persistent round-robin rotation.
            No provider gets favored, state survives restarts.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>Real-Time Updates</h3>
          <p>
            Dashboard updates instantly via Server-Sent Events when new
            leads are assigned — no page refresh needed.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🛡️</div>
          <h3>Concurrency Safe</h3>
          <p>
            Serializable transactions prevent double-assignment even when
            multiple leads are created simultaneously.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>Quota Enforcement</h3>
          <p>
            Each provider has a 10-lead monthly quota. Leads stop
            being assigned when quota is exhausted.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔗</div>
          <h3>Idempotent Webhooks</h3>
          <p>
            Payment webhook with idempotency keys — calling it multiple
            times only resets quota once.
          </p>
        </div>
      </div>
    </div>
  );
}
