/* Fileora module: File Security (3 tools on the processing server). */
(function (E) {
  'use strict';
  if (!E) return;
  const R = def => E.register(Object.assign({ server: true }, def));
  R({ id: 'protect', accept: 'pdf', multi: true, cta: 'Protect PDF', verb: 'Encrypting',
    opts: [
      { id: 'pw', type: 'password', label: 'Password', value: '', placeholder: 'At least 6 characters' },
      { id: 'pw2', type: 'password', label: 'Repeat password', value: '' },
      { id: 'noprint', type: 'toggle', label: 'Block printing and copying', value: false }
    ],
    validate: o => (!o.pw || o.pw.length < 6) ? 'Use a password with at least 6 characters.' : (o.pw !== o.pw2 ? 'The two passwords don’t match.' : '') });
  R({ id: 'unlock', accept: 'pdf', multi: true, passwords: true, cta: 'Unlock PDF', verb: 'Unlocking',
    opts: [
      { id: 'pw', type: 'password', label: 'Current password', value: '', placeholder: 'The password that opens the file',
        help: 'For e-Aadhaar: the first 4 letters of your name in CAPITALS and your year of birth, e.g. RAHU1990.' },
      { id: 'rights', type: 'toggle', label: 'I own this file or have permission to unlock it', value: false }
    ],
    validate(o, items) {
      if (!o.rights) return 'Confirm that you have permission to unlock this file.';
      if (!o.pw && items.some(i => i.locked)) return 'Type the password that opens the file.';
      return '';
    } });
  R({ id: 'redact', accept: 'pdf', cta: 'Redact PDF', verb: 'Redacting',
    opts: [
      { id: 'terms', type: 'textarea', label: 'Words to black out', value: '', placeholder: 'One word or phrase per line' },
      { id: 'emails', type: 'toggle', label: 'Email addresses', value: true },
      { id: 'phones', type: 'toggle', label: 'Phone numbers', value: true }
    ],
    validate: o => String(o.terms || '').trim() || o.emails || o.phones ? '' : 'Type words to black out, or choose emails or phone numbers.' });
})(window.FileoraEngine);
