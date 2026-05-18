/**
 * email.js — EmailJS integration for sending check-in notification emails.
 *
 * When a visitor completes the check-in form, a notification email is sent to
 * the receptionist for the relevant office. EmailJS handles the email delivery
 * without requiring a custom backend — it sends directly from the browser using
 * a pre-configured email service + template linked to the account.
 *
 * Configuration is stored in localStorage and set via the Admin Modal → Email tab:
 *   srm_ejs_key        — EmailJS public API key (from emailjs.com dashboard)
 *   srm_ejs_service    — EmailJS service ID (e.g. "service_abc123")
 *   srm_ejs_template   — EmailJS template ID (e.g. "template_xyz789")
 *   srm_reception_emails — JSON object mapping office names to email addresses
 *
 * If any of the above are missing, sendCheckinEmail silently no-ops so the
 * check-in form submission still succeeds even without email configured.
 */

import emailjs from '@emailjs/browser';

/**
 * getEmailConfig — reads EmailJS credentials from localStorage.
 * Returns an object with empty strings for any unset values.
 *
 * @returns {{ key: string, svc: string, tpl: string }}
 */
export function getEmailConfig() {
  return {
    key: localStorage.getItem('srm_ejs_key')      || '',
    svc: localStorage.getItem('srm_ejs_service')  || '',
    tpl: localStorage.getItem('srm_ejs_template') || '',
  };
}

/**
 * getReceptionistEmail — returns the notification email address for a given
 * office name, or an empty string if none has been configured.
 *
 * Reception emails are stored as a JSON object under "srm_reception_emails"
 * to support multiple offices on a single device (e.g. if this terminal is
 * shared or the admin manages several offices).
 *
 * @param {string} officeName  The office name as it appears in the offices map
 * @returns {string}
 */
export function getReceptionistEmail(officeName) {
  try {
    const all = JSON.parse(localStorage.getItem('srm_reception_emails') || '{}');
    return all[officeName] || '';
  } catch {
    return '';
  }
}

/**
 * sendCheckinEmail — sends a check-in notification email to the receptionist
 * for the given office via EmailJS.
 *
 * The params object is spread directly into the EmailJS template variables, so
 * the template on emailjs.com should use matching variable names:
 *   {{visitor_name}}, {{company}}, {{host}}, {{purpose}},
 *   {{visit_date}}, {{arrival_time}}, {{office_name}},
 *   {{from_postcode}}, {{transport_mode}}, {{distance_km}}, {{co2_kg}}
 *   {{to_email}} — injected here as the recipient address
 *
 * The function silently returns (no-op) if:
 *   - Any EmailJS credential is missing (key, service ID, or template ID)
 *   - No receptionist email is configured for this office
 *
 * Errors are only logged in development mode to avoid leaking internal details
 * in production browser consoles.
 *
 * @param {Object} params     Check-in record fields (pre-formatted for display)
 * @param {string} officeName Used to look up the receptionist's email address
 */
export async function sendCheckinEmail(params, officeName) {
  const { key, svc, tpl } = getEmailConfig();
  const to = getReceptionistEmail(officeName);

  // All four values are required — skip silently rather than throwing
  if (!key || !svc || !tpl || !to) return;

  try {
    // emailjs.init must be called before emailjs.send; passing the key here
    // rather than once at app startup avoids issues if the key changes at runtime
    emailjs.init({ publicKey: key });
    await emailjs.send(svc, tpl, { ...params, to_email: to });
  } catch (e) {
    // Only surface in dev — avoids leaking service IDs in production console
    if (import.meta.env.DEV) console.error('EmailJS:', e);
  }
}
