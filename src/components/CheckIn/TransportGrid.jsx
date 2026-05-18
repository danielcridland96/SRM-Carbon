const OPTIONS = [
  { value: 'car',    icon: '🚗', label: 'Petrol Car' },
  { value: 'diesel', icon: '🚙', label: 'Diesel Car' },
  { value: 'ev',     icon: '⚡', label: 'Electric Car' },
  { value: 'train',  icon: '🚆', label: 'Train' },
  { value: 'bus',    icon: '🚌', label: 'Bus / Coach' },
  { value: 'bike',   icon: '🚲', label: 'Bike / Walk' },
];

export default function TransportGrid({ value, onChange }) {
  return (
    <div className="transport-grid">
      {OPTIONS.map(opt => (
        <div className="transport-option" key={opt.value}>
          <input
            type="radio"
            name="transport"
            id={`t-${opt.value}`}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <label htmlFor={`t-${opt.value}`}>
            <span className="icon">{opt.icon}</span>
            {opt.label}
          </label>
        </div>
      ))}
    </div>
  );
}
