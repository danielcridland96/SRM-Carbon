import { useState } from 'react';
import { getEmailConfig, getReceptionistEmail } from '../../lib/email';

export default function TabEmail({ activeName }) {
  const cfg = getEmailConfig();
  const [key, setKey] = useState(cfg.key);
  const [svc, setSvc] = useState(cfg.svc);
  const [tpl, setTpl] = useState(cfg.tpl);
  const [email, setEmail] = useState(() => getReceptionistEmail(activeName));
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem('srm_ejs_key', key.trim());
    localStorage.setItem('srm_ejs_service', svc.trim());
    localStorage.setItem('srm_ejs_template', tpl.trim());
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
      <div className="modal-field">
        <label>Receptionist Email — <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--fern)' }}>{activeName}</span></label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="reception@srm.com" />
      </div>
      <button className="modal-btn" onClick={save}>Save Email Settings</button>
      {saved && <div className="modal-saved">✅ Email settings saved</div>}
    </>
  );
}
