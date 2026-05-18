import emailjs from '@emailjs/browser';

export function getEmailConfig() {
  return {
    key: localStorage.getItem('srm_ejs_key') || '',
    svc: localStorage.getItem('srm_ejs_service') || '',
    tpl: localStorage.getItem('srm_ejs_template') || '',
  };
}

export function getReceptionistEmail(officeName) {
  try {
    const all = JSON.parse(localStorage.getItem('srm_reception_emails') || '{}');
    return all[officeName] || '';
  } catch { return ''; }
}

export async function sendCheckinEmail(params, officeName) {
  const { key, svc, tpl } = getEmailConfig();
  const to = getReceptionistEmail(officeName);
  if (!key || !svc || !tpl || !to) return;
  try {
    emailjs.init({ publicKey: key });
    await emailjs.send(svc, tpl, { ...params, to_email: to });
  } catch (e) {
    if (import.meta.env.DEV) console.error('EmailJS:', e);
  }
}
