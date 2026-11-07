'use client';

import { useState } from 'react';

export function NewsletterForm({ mode = 'newsletter' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const endpoint = mode === 'waitlist' ? '/api/waitlist' : '/api/newsletter';

  async function submit(event) {
    event.preventDefault();
    setStatus('Submitting...');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'content-mvp' }),
    });
    const body = await response.json().catch(() => ({}));
    setStatus(response.ok ? 'You are on the list.' : body.error || 'Could not submit right now.');
  }

  return (
    <form className="newsletter" onSubmit={submit}>
      <div>
        <h2>{mode === 'waitlist' ? 'Notify me when this ships' : 'Cyber brief in your inbox'}</h2>
        <p>Public beta updates, scam alerts, law explainers, and major cybersecurity advisories.</p>
      </div>
      <label>
        <span>Email</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@domain.com" />
      </label>
      <button type="submit">Join</button>
      {status && <p className="form-status">{status}</p>}
    </form>
  );
}
