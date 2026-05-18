/**
 * TransportGrid — 6-option radio button grid for selecting the visitor's
 * mode of transport.
 *
 * Each option maps to a key in EMISSION_FACTORS (carbon.js), so the value
 * passed to onChange must remain in sync with those keys:
 *   'car' | 'diesel' | 'ev' | 'train' | 'bus' | 'bike'
 *
 * Implemented as styled radio inputs (native <input type="radio">) with visible
 * icon labels rather than a custom click handler — this preserves keyboard
 * navigation and screen-reader accessibility.
 *
 * Props:
 *   value    — currently selected transport key ('' if nothing selected)
 *   onChange — callback receives the new transport key string
 */

// All six transport modes. The 'value' strings must match the keys in EMISSION_FACTORS.
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
          {/* Radio input is visually hidden by CSS; the styled label acts as the click target */}
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
