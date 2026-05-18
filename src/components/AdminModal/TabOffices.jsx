import { useState } from 'react';
import { loadOffices, saveOffices } from '../../lib/offices';

const BLANK = { name: '', address: '', postcode: '' };

export default function TabOffices({ onOfficesChange }) {
  const [offices, setOffices] = useState(loadOffices);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [saved, setSaved] = useState(false);

  function commit() {
    const name = form.name.trim();
    const address = form.address.trim();
    const postcode = form.postcode.trim().toUpperCase();
    if (!name || !address || !postcode) return;

    const updated = { ...offices };
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

  function startEdit(name) {
    setEditing(name);
    setForm({ name, ...offices[name] });
  }

  function cancel() {
    setEditing(null);
    setForm(BLANK);
  }

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
