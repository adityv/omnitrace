const REDACTED = '[REDACTED]';

const AUTHORIZATION_HEADER_PATTERN = /(authorization\s*:\s*(?:bearer|basic)\s+)([^\s,;]+)/gi;
const SECRET_ASSIGNMENT_PATTERN = /((?:["']?)(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret|secret|password|passwd|token)(?:["']?\s*[:=]\s*))(["']?)([^\s,;\]}"']+)\2/gi;
const REDACTION_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:ASIA|AIDA)[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  /\b(?:\d[ -]*?){13,19}\b/g,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  /(?<![0-9A-Fa-f:])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?![0-9A-Fa-f:])/g,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
];

function sanitizeLog(text) {
  if (typeof text !== 'string') {
    throw new TypeError('sanitizeLog expects a string.');
  }

  let sanitized = text.replace(AUTHORIZATION_HEADER_PATTERN, (_match, prefix) => `${prefix}${REDACTED}`);
  sanitized = sanitized.replace(
    SECRET_ASSIGNMENT_PATTERN,
    (_match, prefix, quote) => `${prefix}${quote || ''}${REDACTED}${quote || ''}`
  );

  for (const pattern of REDACTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, REDACTED);
  }
  return sanitized;
}

function containsSensitiveValue(text) {
  return sanitizeLog(text) !== text;
}

module.exports = {
  REDACTED,
  sanitizeLog,
  containsSensitiveValue
};
