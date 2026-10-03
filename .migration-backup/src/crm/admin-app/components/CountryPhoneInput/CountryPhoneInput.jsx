import React, { useState, useRef, useEffect, useCallback } from 'react';
import { COUNTRY_LIST } from '../../countryData';
import { formatPhoneDigits } from '../../../shared/phoneFormat';
import './CountryPhoneInput.css';

// ─── Digit count constraints ─────────────────────────────────────────────────
const PHONE_DIGITS = {
  AF:[9,9],  AL:[9,9],  DZ:[9,9],  AD:[6,6],  AO:[9,9],
  AG:[7,7],  AR:[10,11],AM:[8,8],  AU:[9,9],  AT:[4,13],
  AZ:[9,9],  BS:[7,7],  BH:[8,8],  BD:[10,10],BB:[7,7],
  BY:[9,9],  BE:[8,9],  BZ:[7,7],  BJ:[8,8],  BT:[7,8],
  BO:[8,8],  BA:[8,8],  BW:[8,8],  BR:[10,11],BN:[7,7],
  BG:[9,9],  BF:[8,8],  BI:[8,8],  CV:[7,7],  KH:[8,9],
  CM:[9,9],  CA:[10,10],CF:[8,8],  TD:[8,8],  CL:[9,9],
  CN:[11,11],CO:[10,10],KM:[7,7],  CG:[9,9],  CD:[9,9],
  CR:[8,8],  HR:[8,9],  CU:[8,8],  CY:[8,8],  CZ:[9,9],
  DK:[8,8],  DJ:[8,8],  DM:[7,7],  DO:[10,10],EC:[9,9],
  EG:[10,10],SV:[8,8],  GQ:[9,9],  ER:[7,7],  EE:[7,8],
  SZ:[8,8],  ET:[9,9],  FJ:[7,7],  FI:[5,12], FR:[9,9],
  GA:[8,8],  GM:[7,7],  GE:[9,9],  DE:[3,12], GH:[9,9],
  GR:[10,10],GD:[7,7],  GT:[8,8],  GN:[9,9],  GW:[7,7],
  GY:[7,7],  HT:[8,8],  HN:[8,8],  HU:[9,9],  IS:[7,7],
  IN:[10,10],ID:[9,12], IR:[10,10],IQ:[10,10],IE:[9,9],
  IL:[9,9],  IT:[6,11], JM:[7,7],  JP:[10,11],JO:[9,9],
  KZ:[10,10],KE:[9,9],  KI:[8,8],  KW:[8,8],  KG:[9,9],
  LA:[8,9],  LV:[8,8],  LB:[7,8],  LS:[8,8],  LR:[8,8],
  LY:[9,9],  LI:[7,9],  LT:[8,8],  LU:[9,11], MG:[9,9],
  MW:[9,9],  MY:[9,10], MV:[7,7],  ML:[8,8],  MT:[8,8],
  MH:[7,7],  MR:[8,8],  MU:[8,8],  MX:[10,10],FM:[7,7],
  MD:[8,8],  MC:[8,9],  MN:[8,8],  ME:[8,8],  MA:[9,9],
  MZ:[9,9],  MM:[8,9],  NA:[9,9],  NR:[7,7],  NP:[9,10],
  NL:[9,9],  NZ:[8,9],  NI:[8,8],  NE:[8,8],  NG:[8,10],
  KP:[10,10],MK:[8,8],  NO:[8,8],  OM:[8,8],  PK:[10,10],
  PW:[7,7],  PS:[9,9],  PA:[8,8],  PG:[8,8],  PY:[9,9],
  PE:[9,9],  PH:[10,10],PL:[9,9],  PT:[9,9],  QA:[8,8],
  RO:[9,9],  RU:[10,10],RW:[9,9],  KN:[7,7],  LC:[7,7],
  VC:[7,7],  WS:[7,7],  SM:[6,10], ST:[7,7],  SA:[9,9],
  SN:[9,9],  RS:[8,9],  SC:[7,7],  SL:[8,8],  SG:[8,8],
  SK:[9,9],  SI:[8,8],  SB:[7,7],  SO:[7,8],  ZA:[9,9],
  KR:[9,10], SS:[9,9],  ES:[9,9],  LK:[9,9],  SD:[9,9],
  SR:[7,7],  SE:[7,13], CH:[9,9],  SY:[9,9],  TW:[9,9],
  TJ:[9,9],  TZ:[9,9],  TH:[9,9],  TL:[7,8],  TG:[8,8],
  TO:[5,7],  TT:[7,7],  TN:[8,8],  TR:[10,10],TM:[8,8],
  TV:[5,6],  UG:[9,9],  UA:[9,9],  AE:[9,9],  GB:[10,10],
  US:[10,10],UY:[9,9],  UZ:[9,9],  VU:[7,7],  VA:[10,10],
  VE:[10,10],VN:[9,10], YE:[9,9],  ZM:[9,9],  ZW:[9,9],
};

// ─── Digit constraint helper ──────────────────────────────────────────────────

function getDigitConstraints(countryCode) {
  if (!countryCode) return { min: 4, max: 15 };
  const d = PHONE_DIGITS[countryCode];
  return d ? { min: d[0], max: d[1] } : { min: 4, max: 15 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate phone number by ISO country code (not dial code) to avoid
 * ambiguity with shared codes like +1 (US/Canada) or +7 (Russia/Kazakhstan).
 * Returns true when number is empty (phone is optional in all forms).
 */
export function isPhoneValid(countryCode, number) {
  if (!number || number.trim().length === 0) return true;
  const { min, max } = getDigitConstraints(countryCode || null);
  const digits = number.replace(/\D/g, '').length;
  return digits >= min && digits <= max;
}

/**
 * Parse a stored phone string like "+44 7911123456" or "+1-268 5550000"
 * back into { countryCode, dialCode, number } parts.
 * Tries longest dial codes first to avoid partial matches (e.g. "+1-268" before "+1").
 */
export function parseStoredPhone(phone) {
  if (!phone) return { countryCode: '', dialCode: '', number: '' };
  const s = phone.trim();
  if (!s.startsWith('+')) {
    return { countryCode: '', dialCode: '', number: s.replace(/\D/g, '') };
  }
  const sorted = [...COUNTRY_LIST].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (s === c.dial) {
      return { countryCode: c.code, dialCode: c.dial, number: '' };
    }
    if (s.startsWith(c.dial + ' ')) {
      const number = s.slice(c.dial.length + 1).replace(/\D/g, '');
      return { countryCode: c.code, dialCode: c.dial, number };
    }
  }
  return { countryCode: '', dialCode: '', number: s.replace(/[^\d]/g, '') };
}

/**
 * Build stored phone string from countryCode + number digits.
 * Returns "" when number is empty.
 */
export function buildStoredPhone(countryCode, number) {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return '';
  const country = COUNTRY_LIST.find(c => c.code === countryCode);
  if (country) return `${country.dial} ${digits}`;
  return digits;
}

// ─── Internal sub-components ──────────────────────────────────────────────────

function FlagImg({ code, name }) {
  const [err, setErr] = useState(false);
  if (!code || err) {
    return <span className="cdx-cp-flag-fallback">{code?.slice(0, 2) || '?'}</span>;
  }
  return (
    <img
      className="cdx-cp-flag"
      src={`https://flagcdn.com/20x15/${code.toLowerCase()}.png`}
      alt={name || code}
      onError={() => setErr(true)}
    />
  );
}

function SearchIcon() {
  return (
    <svg className="cdx-cp-search-icon" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg className={`cdx-cp-chevron${open ? ' cdx-cp-open' : ''}`}
      width="10" height="6" viewBox="0 0 10 6" fill="none">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  const close = useCallback(() => { setOpen(false); setSearch(''); }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [close]);

  return { open, setOpen, search, setSearch, wrapRef, searchRef, close };
}

// ─── CountrySelect ────────────────────────────────────────────────────────────

export function CountrySelect({ value, onChange, placeholder = 'Select country...' }) {
  const { open, setOpen, search, setSearch, wrapRef, searchRef, close } = useDropdown();

  const selected = COUNTRY_LIST.find(c => c.code === value) || null;

  const filtered = search.trim()
    ? COUNTRY_LIST.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRY_LIST;

  const select = (c) => { onChange(c); close(); };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <div
        className={`cdx-cp-trigger${open ? ' cdx-cp-open' : ''}`}
        onClick={() => open ? close() : setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && (open ? close() : setOpen(true))}
      >
        {selected ? (
          <>
            <FlagImg code={selected.code} name={selected.name} />
            <span className="cdx-cp-trigger-name">{selected.name}</span>
          </>
        ) : (
          <span className="cdx-cp-trigger-placeholder">{placeholder}</span>
        )}
        <ChevronIcon open={open} />
      </div>

      {open && (
        <div className="cdx-cp-dropdown">
          <div className="cdx-cp-search-wrap">
            <SearchIcon />
            <input
              ref={searchRef}
              className="cdx-cp-search"
              value={search}
              onChange={e => setSearch(e.target.value.replace(/[0-9]/g, ''))}
              placeholder="Search country..."
              inputMode="text"
            />
          </div>
          <div className="cdx-cp-list">
            {filtered.length === 0
              ? <div className="cdx-cp-empty">No results</div>
              : filtered.map(c => (
                <div
                  key={c.code}
                  className={`cdx-cp-row${c.code === value ? ' cdx-cp-selected' : ''}`}
                  onClick={() => select(c)}
                >
                  <FlagImg code={c.code} name={c.name} />
                  <span className="cdx-cp-row-name">{c.name}</span>
                  <span className="cdx-cp-row-dial">{c.dial}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PhoneInput ───────────────────────────────────────────────────────────────

/**
 * PhoneInput - structured phone entry with flag + dial code picker and
 * real-time per-country formatting (e.g. US: "555 123 4567").
 *
 * Props:
 *   countryCode           ISO-3166-1 alpha-2 code of the dialling country (e.g. "US").
 *   onCountryCodeChange   Called with new ISO code when user picks a country.
 *   number                Raw digit-only string for the national number (e.g. "5551234567").
 *   onNumberChange        Called with digit-only string on every keystroke.
 *
 * Internally:
 *   - Displays a formatted string (spaces between groups per country pattern).
 *   - Stores and passes raw digits so callers never need to deal with formatting.
 *   - Handles backspace over spaces: removes the preceding digit as well.
 */
export function PhoneInput({ countryCode, onCountryCodeChange, number, onNumberChange }) {
  const { open, setOpen, search, setSearch, wrapRef, searchRef, close } = useDropdown();

  const selectedCountry = COUNTRY_LIST.find(c => c.code === countryCode) || null;
  const dialCode = selectedCountry?.dial || '';
  const { min, max } = getDigitConstraints(countryCode || null);
  const rawDigits = (number || '').replace(/\D/g, '');
  const digitCount = rawDigits.length;

  const displayValue = countryCode
    ? formatPhoneDigits(countryCode, rawDigits)
    : rawDigits;

  let counterColor = 'var(--crm-text-secondary)';
  if (selectedCountry && rawDigits.length > 0) {
    if (digitCount < min) counterColor = 'var(--crm-accent)';
    else if (digitCount > max) counterColor = '#FF6B61';
    else counterColor = '#0ECB81';
  }

  const handleChange = (e) => {
    const newRaw = e.target.value;
    const newDigits = newRaw.replace(/\D/g, '');
    if (newDigits.length === rawDigits.length && newRaw.length < displayValue.length) {
      onNumberChange(rawDigits.slice(0, -1));
      return;
    }
    if (newDigits.length <= max) {
      onNumberChange(newDigits);
    }
  };

  const filtered = search.trim()
    ? COUNTRY_LIST.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRY_LIST;

  return (
    <div style={{ width: '100%' }}>
      <div ref={wrapRef} className="cdx-phone-wrap">

        <div
          className={`cdx-phone-dial-btn${open ? ' cdx-cp-open' : ''}`}
          onClick={() => open ? close() : setOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && (open ? close() : setOpen(true))}
        >
          {selectedCountry
            ? <FlagImg code={selectedCountry.code} name={selectedCountry.name} />
            : <span style={{ fontSize: 14, lineHeight: 1 }}></span>
          }
          <span className={`cdx-phone-dial-code${!dialCode ? ' cdx-empty' : ''}`}>
            {dialCode || '+-'}
          </span>
          <ChevronIcon open={open} />
        </div>

        <input
          type="tel"
          className="cdx-phone-number"
          value={displayValue}
          onChange={handleChange}
          placeholder={countryCode ? formatPhoneDigits(countryCode, '0'.repeat(min)).replace(/0/g, '#') : 'Phone number'}
          inputMode="numeric"
        />

        {selectedCountry && rawDigits.length > 0 && (
          <span style={{
            fontSize: 11,
            color: counterColor,
            padding: '0 10px 0 4px',
            flexShrink: 0,
            alignSelf: 'center',
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 0.15s',
            whiteSpace: 'nowrap',
          }}>
            {digitCount}/{min === max ? max : `${min}-${max}`}
          </span>
        )}

        {open && (
          <div className="cdx-cp-dropdown cdx-cp-dropdown-phone">
            <div className="cdx-cp-search-wrap">
              <SearchIcon />
              <input
                ref={searchRef}
                className="cdx-cp-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search country or code..."
              />
            </div>
            <div className="cdx-cp-list">
              {filtered.length === 0
                ? <div className="cdx-cp-empty">No results</div>
                : filtered.map(c => (
                  <div
                    key={c.code}
                    className={`cdx-cp-row${c.code === countryCode ? ' cdx-cp-selected' : ''}`}
                    onClick={() => { onCountryCodeChange(c.code); close(); }}
                  >
                    <FlagImg code={c.code} name={c.name} />
                    <span className="cdx-cp-row-name">{c.name}</span>
                    <span className="cdx-cp-row-dial">{c.dial}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {selectedCountry && rawDigits.length > 0 && digitCount < min && (
        <div style={{ fontSize: 11, color: 'var(--crm-accent)', marginTop: 3, paddingLeft: 2 }}>
          {min === max
            ? `Requires exactly ${min} digits`
            : `Requires ${min}-${max} digits`}
        </div>
      )}
      {selectedCountry && rawDigits.length > 0 && digitCount > max && (
        <div style={{ fontSize: 11, color: '#FF6B61', marginTop: 3, paddingLeft: 2 }}>
          Too many digits (max {max})
        </div>
      )}
    </div>
  );
}
