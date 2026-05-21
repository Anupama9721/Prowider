'use client';
import { useState, useEffect } from 'react';

export default function RequestService() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: '',
    serviceId: '',
    description: '',
  });
  const [status, setStatus] = useState(null); // {type: 'success'|'error', message}
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      setServices(data);
    } catch {
      setServices([
        { id: 1, name: 'Service 1' },
        { id: 2, name: 'Service 2' },
        { id: 3, name: 'Service 3' },
      ]);
    }
  }

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setStatus(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          serviceId: parseInt(form.serviceId),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: 'error', message: data.error || 'Submission failed' });
      } else {
        setStatus({
          type: 'success',
          message: `Lead submitted successfully! Assigned to ${data.assignedProviders} provider(s).`,
        });
        setForm({ name: '', phone: '', city: '', serviceId: '', description: '' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="page-header">
        <h1>Request a Service</h1>
        <p>Fill out the form below and we'll connect you with the right providers.</p>
      </div>

      <div className="card">
        {status && (
          <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="John Smith"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="9999999999"
                value={form.phone}
                onChange={handleChange}
                pattern="[0-9]{10}"
                maxLength={10}
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="city">City</label>
              <input
                id="city"
                name="city"
                type="text"
                placeholder="Mumbai"
                value={form.city}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="serviceId">Service Type</label>
              <select
                id="serviceId"
                name="serviceId"
                value={form.serviceId}
                onChange={handleChange}
                required
              >
                <option value="">Select a service...</option>
                {services && services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              placeholder="Describe your service requirement..."
              value={form.description}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Submitting...
              </>
            ) : (
              'Submit Enquiry'
            )}
          </button>
        </form>

        <hr className="divider" />

        <div className="text-sm text-muted">
          <strong style={{ color: 'var(--text-dim)' }}>Duplicate rule:</strong> The same phone number
          cannot submit a lead for the same service twice. Different services are allowed.
        </div>
      </div>
    </div>
  );
}
