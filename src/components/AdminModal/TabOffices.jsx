/**
 * TabOffices — admin modal tab for managing the full list of office locations.
 *
 * Provides a CRUD interface for the offices stored in localStorage:
 *   - Lists all current offices with edit (✏️) and delete (🗑️) buttons
 *   - Add New Office form at the bottom (also used for editing when an
 *     office is selected for editing — the form heading and button label change)
 *
 * Workflow:
 *   Add:    Fill in the form → "Save Office" → entry appended to localStorage
 *   Edit:   Click ✏️ → form pre-fills with existing data → "Update Office" saves
 *   Delete: Click 🗑️ → window.confirm dialog → entry removed from localStorage
 *
 * When editing, if the admin changes the office name, the old key is deleted
 * and a new key is created (see commit() logic below).
 *
 * All changes are propagated up to CheckInPage via onOfficesChange so the
 * TabOffice dropdown and carbon calculation always reflect the latest list.
 *
 * Props:
 *   onOfficesChange — callback receives the updated offices object after any change
 */

import { useState } from 'react';
import { loadOffices, saveOffices } from '../../lib/offices';

// Empty form state — used to reset the form after save or cancel
const BLANK = { name: '', address: '', postcode: '' };

export default function TabOffices({ onOfficesChange }) {
  const [offices, setOffices] = useState(loadOffices);    // Current offices map
  const [form, setForm]       = useState(BLANK);          // Add/edit form values
  const [editing, setEditing] = useState(null);           // Name of the office being edited, or null
  const [saved, setSaved]     = useState(false);          // Controls the ✅ confirmation flash

  /**
   * commit — validates and persists the current form state.
   * Handles both add (editing === null) and edit (editing === existing name) cases.
   * If the office name was changed during an edit, the old key is deleted.
   */
  function commit() {
    const name     = form.name.trim();
    const address  = form.address.trim();
    const postcode = form.postcode.trim().toUpperCase();

    // All three fields are required
    if (!name || !address || !postcode) return;

    const updated = { ...offices };

    // If editing and the name changed, remove the old key before adding the new one
    if (editing && editing !== name) delete updated[editing];

    updated[name] = { address, postcode };
    saveOffices(updated);
    setOffices(updated);
    onOfficesChange(updated);
    setForm(BLANK);
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  /** startEdit — pre-fills the form with the selected office's current data. */
  function startEdit(name) {
    setEditing(name);
    setForm({ name, ...offices[name] });
  }

  /** cancel — exits edit mode and resets the form to blank. */
  function cancel() {
    setEditing(null);
    setForm(BLANK);
  }

  /** remove — confirms and deletes an office from localStorage and state. */
  function remove(name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const updated = { ...offices };
    delete updated[name];
    saveOffices(updated);
    setOffices(updated);
    onOfficesChange(updated);
  }

  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
        Add, edit or remove offices. Changes take effect immediately.
      </p>

      {/* Scrollable list of existing offices */}
      <div style={{ marginBottom: 14, maxHeight: 280, overflowY: 'auto' }}>
        {Object.entries(offices).map(([name, o]) => (
          <div className="office-row" key={name}>
            <div className="office-row-info">
              <div className="office-row-name">{name}</div>
              <div className="office-row-detail">{o.address} · {o.postcode}</div>
            </div>
            <div className="office-row-actions">
              <button className="btn-icon" onClick={() => startEdit(name)}>✏️</button>
              <button className="btn-icon del" onClick={() => remove(name)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / edit form */}
      <div style={{ background: 'var(--cream)', borderRadius: 12, padding: 14, border: '1.5px solid var(--sand)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)', marginBottom: 12, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {editing ? 'Edit Office' : 'Add New Office'}
        </div>
        <div className="modal-field">
          <label>Office Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Edinburgh" />
        </div>
        <div className="modal-field">
          <label>Address</label>
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. 1 Princes St, Edinburgh" />
        </div>
        <div className="modal-field">
          <label>Postcode</label>
          {/* Postcode is uppercased on input — postcodes.io requires uppercase */}
          <input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value.toUpperCase() }))} placeholder="e.g. EH1 1AB" />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="modal-btn" style={{ padding: 10 }} onClick={commit}>
            {editing ? 'Update Office' : 'Save Office'}
          </button>
          {editing && (
            <button className="modal-btn secondary" style={{ padding: 10 }} onClick={cancel}>Cancel</button>
          )}
        </div>
        {saved && <div className="modal-saved">✅ Saved</div>}
      </div>
    </>
  );
}
