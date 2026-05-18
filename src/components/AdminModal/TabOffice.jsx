import { useState } from 'react';
import { saveActiveOfficeName } from '../../lib/offices';

export default function TabOffice({ offices, activeName, onOfficeChange, onClose }) {
  const [selected, setSelected] = useState(activeName);
  const [saved, setSaved] = useState(false);

  function save() {
    saveActiveOfficeName(selected);
    onOfficeChange(selected);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1800);
  }

  return (
    <>
      <div className="modal-field">
        <label>Active Office</label>
        <select value={selected} onChange={e => setSelected(e.target.value)}>
          {Object.keys(offices).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <button className="modal-btn" onClick={save}>Save Office</button>
      {saved && <div className="modal-saved">✅ Office updated</div>}
    </>
  );
}
