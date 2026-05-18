/**
 * OfficeBanner — displays which office the visitor is checking in to.
 *
 * Shown at the top of the check-in form so visitors immediately see which
 * location they're registering at. The active office is managed in
 * CheckInPage state and can be changed by an admin via the Device Settings modal.
 *
 * Props:
 *   name     — office display name, e.g. "London"
 *   address  — street address string
 *   postcode — UK postcode, displayed as a badge on the right
 */
export default function OfficeBanner({ name, address, postcode }) {
  return (
    <div className="office-banner">
      <div className="ob-icon">🏢</div>
      <div>
        <div className="ob-label">You are visiting</div>
        <div className="ob-name">{name}</div>
        <div className="ob-address">{address}</div>
      </div>
      {/* Postcode shown separately as a pill — it's also used in carbon calculations */}
      <div className="ob-postcode">{postcode}</div>
    </div>
  );
}
