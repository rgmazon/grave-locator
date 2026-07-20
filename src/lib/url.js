// Only http/https URLs are safe to use as an href/src for user-submitted
// links and images. Anything else (javascript:, data:, vbscript:, etc.) can
// execute in the viewer's session when clicked/rendered, so it must be
// rejected rather than passed through.
export function isHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
