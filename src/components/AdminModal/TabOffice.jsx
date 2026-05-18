/**
 * TabOffice — admin modal tab for switching the active office on this terminal.
 *
 * The "active office" determines:
 *   1. Which office is displayed in OfficeBanner on the check-in form
 *   2. The destination postcode used for carbon distance calculations
 *   3. The office_name field written to the database on check-in
 *   4. Which receptionist email address receives check-in notifications
 *
 * The selection is persisted to localStorage ("srm_office") via saveActiveOfficeName,
 * so the terminal remembers its configured office across browser sessions.
 *
 * After saving, the modal automatically closes after 1.8 seconds so the admin
 * can see the confirmation message before the modal dismisses.
 *
 * Props:
 *   offices        — the current offices map (passed from AdminModal)
 *   activeName     — currently configured office name
 *   onOfficeChange — callback to update CheckInPage state with the new office name
 *   onClose        — closes the modal (called after save confirmation timeout)
 */

import { useState } from 'react';
import { saveActiveOfficeName } from '../../lib/offices';

export default function TabOffice({ offices, activeName, onOfficeChange, onClose }) {
  const [selected, setSelected] = useState(activeName);
  const [saved, setSaved] = useState(false);

  /**
   * save — persists the selected office to localStorage, notifies the parent
   * via onOfficeChange (so carbon calculation uses the new postcode immediately),
   * then auto-closes the modal after a brief confirmation flash.
   */
  function save() {
    saveActiveOfficeName(selected);
    onOfficeChange(selected);
    setSaved(true);
    // Close after 1.8s so the admin can read the ✅ confirmation before dismissal
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
