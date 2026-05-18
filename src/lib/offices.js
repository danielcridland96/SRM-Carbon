/**
 * offices.js — Default office list and localStorage persistence helpers.
 *
 * Offices are stored as a plain object keyed by office name, with each value
 * containing an address string and a UK postcode. The postcode is used by the
 * carbon calculation to determine the destination coordinates via postcodes.io.
 *
 * Persistence: admins can add/edit/remove offices via the Admin Modal → Offices
 * tab. Changes are saved to localStorage under the key "srm_offices". On load,
 * the stored value is validated and sanitised before use to guard against
 * corrupted or malicious localStorage content.
 *
 * The active office (the one currently displayed on the check-in screen) is
 * stored separately under "srm_office" as a plain string key.
 */

/**
 * DEFAULT_OFFICES — the built-in list of Sir Robert McAlpine office locations.
 * Used when localStorage has no saved offices, or when the stored data fails
 * validation. Postcodes must be accurate — they are passed directly to the
 * postcodes.io API for coordinate lookup.
 */
export const DEFAULT_OFFICES = {
  'Birmingham':           { postcode: 'B3 3AS',   address: '12-22 Newhall St, Birmingham' },
  'Bristol':              { postcode: 'BS32 4TT', address: '100 Park Ave, Bradley Stoke, Bristol' },
  'Kettering Plant Dept': { postcode: 'NN15 6JQ', address: 'Pytchley Lodge Rd, Kettering' },
  'Kings Langley (HQ)':  { postcode: 'WD4 8UD',  address: 'Concept House, Home Park Mill Link, Kings Langley' },
  'Knutsford':            { postcode: 'WA16 8GS', address: 'Booths Park, Chelford Rd, Knutsford' },
  'London':               { postcode: 'SW1X 7EP', address: 'Yorkshire House, Grosvenor Crescent, London' },
  'Manchester':           { postcode: 'M2 3WQ',   address: '15 Oxford Court, Manchester' },
  'Newcastle':            { postcode: 'NE1 1TH',  address: '1 St Nicholas St, Newcastle upon Tyne' },
};

/**
 * loadOffices — reads the office list from localStorage and returns it after
 * validation. Falls back to DEFAULT_OFFICES if:
 *   - Nothing is stored yet
 *   - The stored JSON is malformed or not a plain object
 *   - Validation rejects all entries (e.g. all are malformed)
 *
 * Security / robustness notes:
 * - JSON.parse is wrapped in try/catch to handle corrupted storage
 * - Each entry is checked to be a string key (≤100 chars) with string
 *   address and postcode values before being included
 * - Postcodes are stripped of any non-alphanumeric characters (except space)
 *   and capped at 10 characters to prevent injection into API requests
 * - Addresses are capped at 200 characters
 *
 * @returns {Object.<string, {address: string, postcode: string}>}
 */
export function loadOffices() {
  try {
    const saved = localStorage.getItem('srm_offices');
    if (!saved) return DEFAULT_OFFICES;

    const parsed = JSON.parse(saved);

    // Must be a plain object, not an array or primitive
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_OFFICES;

    const validated = {};
    for (const [name, val] of Object.entries(parsed)) {
      if (
        typeof name === 'string' &&
        name.length <= 100 &&
        typeof val?.address === 'string' &&
        typeof val?.postcode === 'string'
      ) {
        validated[name] = {
          address:  val.address.slice(0, 200),
          // Strip any characters that aren't alphanumeric or space to prevent
          // injecting unexpected characters into the postcodes.io URL
          postcode: val.postcode.replace(/[^A-Z0-9 ]/gi, '').slice(0, 10),
        };
      }
    }

    // If validation rejected everything, use the defaults rather than an empty map
    return Object.keys(validated).length ? validated : DEFAULT_OFFICES;
  } catch {
    return DEFAULT_OFFICES;
  }
}

/**
 * saveOffices — serialises the entire offices map to localStorage.
 * Called by TabOffices after any add, edit, or delete operation.
 *
 * @param {Object.<string, {address: string, postcode: string}>} obj
 */
export function saveOffices(obj) {
  localStorage.setItem('srm_offices', JSON.stringify(obj));
}

/**
 * loadActiveOfficeName — returns the name of the currently selected office
 * for this reception terminal, defaulting to 'London' if none is saved.
 * The active office is displayed in the OfficeBanner and used as the
 * destination postcode in carbon calculations.
 *
 * @returns {string}
 */
export function loadActiveOfficeName() {
  return localStorage.getItem('srm_office') || 'London';
}

/**
 * saveActiveOfficeName — persists the selected office name to localStorage.
 * Called by TabOffice when the admin saves an office change.
 *
 * @param {string} name  Must be a key that exists in the current offices map
 */
export function saveActiveOfficeName(name) {
  localStorage.setItem('srm_office', name);
}
