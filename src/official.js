LF.idFromUrl = function idFromUrl(url) {
  const text = String(url || "");
  const color = text.match(/\/color-lyrics\/v2\/track\/([^/?#/]+)/i);
  if (color) return { kind: "color-lyrics", id: decodeURIComponent(color[1]) };
  const meta = text.match(/\/metadata\/4\/track\/([^/?#/]+)/i);
  if (meta) return { kind: "metadata", id: decodeURIComponent(meta[1]) };
  return null;
};

LF.isOfficialColorBody = function isOfficialColorBody(body) {
  return !!(body && body.lyrics && Array.isArray(body.lyrics.lines) && body.lyrics.lines.length);
};

LF.isOfficialMetadata = function isOfficialMetadata(body) {
  return !!(body && body.has_lyrics);
};

LF.isOfficialCachedLyrics = function isOfficialCachedLyrics(data) {
  if (!data || !data.hasLyrics) return false;
  const provider = String(data.provider || "");
  const display = String(data.providerDisplayName || "");
  if (LF.providers && LF.providers.isFallbackName(provider)) return false;
  if (LF.providers && LF.providers.isFallbackName(display)) return false;
  return true;
};
