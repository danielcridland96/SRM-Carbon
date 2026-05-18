export default function OfficeBanner({ name, address, postcode }) {
  return (
    <div className="office-banner">
      <div className="ob-icon">🏢</div>
      <div>
        <div className="ob-label">You are visiting</div>
        <div className="ob-name">{name}</div>
        <div className="ob-address">{address}</div>
      </div>
      <div className="ob-postcode">{postcode}</div>
    </div>
  );
}
