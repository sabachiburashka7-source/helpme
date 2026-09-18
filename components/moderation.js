// Report reasons, shared by the report sheet in BrowseScreen and the
// translation dictionaries in i18n.js.
//
// `key` is what goes over the wire. It MUST stay in sync with the
// REPORT_REASONS set in cloudflare/src/index.js — the Worker rejects
// anything it does not recognise with a 400. `label` is the English
// source string, which is also the i18n lookup key, so every label here
// needs an entry in the ru and ka dictionaries.
export const REPORT_REASONS = [
  { key: 'spam', label: 'Spam or misleading' },
  { key: 'scam', label: 'Scam or fraud' },
  { key: 'offensive', label: 'Offensive or hateful' },
  { key: 'sexual', label: 'Sexual content' },
  { key: 'violence', label: 'Violence or threats' },
  { key: 'illegal', label: 'Illegal goods or services' },
  { key: 'other', label: 'Something else' },
];
