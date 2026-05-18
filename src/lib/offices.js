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

export function loadOffices() {
  try {
    const saved = localStorage.getItem('srm_offices');
    return saved ? JSON.parse(saved) : DEFAULT_OFFICES;
  } catch {
    return DEFAULT_OFFICES;
  }
}

export function saveOffices(obj) {
  localStorage.setItem('srm_offices', JSON.stringify(obj));
}

export function loadActiveOfficeName() {
  return localStorage.getItem('srm_office') || 'London';
}

export function saveActiveOfficeName(name) {
  localStorage.setItem('srm_office', name);
}
