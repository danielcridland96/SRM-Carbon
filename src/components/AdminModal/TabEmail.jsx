/**
 * TabEmail — admin modal tab for configuring EmailJS notification settings.
 *
 * EmailJS allows the app to send emails directly from the browser without
 * a backend. An admin must create a free account at emailjs.com, set up an
 * email service (e.g. Gmail, Outlook), and create a template with the
 * visitor check-in fields as template variables.
 *
 * Four settings are stored in localStorage:
 *   srm_ejs_key          — EmailJS public key (Account → API Keys)
 *   srm_ejs_service      — Service ID (Email Services → your service ID)
 *   srm_ejs_template     — Template ID (Email Templates → your template ID)
 *   srm_reception_emails — JSON object of { officeName: emailAddress }
 *                          (the receptionist email shown per office)
 *
 * The receptionist email field displays which office it applies to (activeName),
 * so if multiple offices share a terminal, the admin must configure each office
 * separately by switching offices in the Office tab first.
 *
 * If any credential is missing, sendCheckinEmail in email.js silently skips
 * sending — the check-in submission still completes normally.
 *
 * Props:
 *   activeName — the currently selected office name (from CheckInPage state),
 *                used to label the receptionist email field and load/save the
 *                correct per-office email address
 */

import { useState } from 'react';
import { getEmailConfig, getReceptionistEmail } from '../../lib/email';

export default function TabEmail({ activeName }) {
  // Initialise all fields from localStorage on first render
  const cfg = getEmailConfig();
  const [key,   setKey]   = useState(cfg.key);
  const [svc,   setSvc]   = useState(cfg.svc);
  const [tpl,   setTpl]   = useState(cfg.tpl);
  const [email, setEmail] = useState(() => getReceptionistEmail(activeName));
  const [saved, setSaved] = useState(false);

  /**
   * save — writes all four settings to localStorage.
   * The receptionist email is merged into the existing per-office map so that
   * other offices' addresses aren't overwritten when editing one office.
   */
  function save() {
    localStorage.setItem('srm_ejs_key',      key.trim());
    localStorage.setItem('srm_ejs_service',  svc.trim());
    localStorage.setItem('srm_ejs_template', tpl.trim());

    // Merge into existing per-office email map rather than overwriting it
    const all = JSON.parse(localStorage.getItem('srm_reception_emails') || '{}');
    all[activeName] = email.trim();
    localStorage.setItem('srm_reception_emails', JSON.stringify(all));

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
        Sends check-in notifications via <strong>EmailJS</strong>.{' '}
        <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" style={{ color: 'var(--fern)' }}>Free account →</a>
      </p>

      {/* EmailJS account credentials */}
      <div className="modal-field">
        <label>Public Key</label>
        <input value={key} onChange={e => setKey(e.target.value)} placeholder="abc123…" />
      </div>
      <div className="modal-field">
        <label>Service ID</label>
        <input value={svc} onChange={e => setSvc(e.target.value)} placeholder="service_xxx" />
      </div>
      <div className="modal-field">
        <label>Template ID</label>
        <input value={tpl} onChange={e => setTpl(e.target.value)} placeholder="template_xxx" />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--sand)', margin: '14px 0' }} />

      {/* Per-office receptionist email — scoped to the currently active office */}
      <div className="modal-field">
        <label>
          Receptionist Email —{' '}
          <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--fern)' }}>{activeName}</span>
        </label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="reception@srm.com" />
      </div>

      <button className="modal-btn" onClick={save}>Save Email Settings</button>
      {saved && <div className="modal-saved">✅ Email settings saved</div>}
    </>
  );
}
