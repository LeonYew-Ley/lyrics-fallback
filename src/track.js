LF.currentTrack = function currentTrack() {
  const item = Spicetify?.Player?.data?.item || Spicetify?.Player?.data?.track;
  if (!item) return null;
  const meta = item.metadata || {};
  const uri = item.uri || meta.uri || "";
  const base62 = (uri.split(":")[2] || "").split("?")[0];
  const title = item.name || meta.title || "";
  const album =
    (item.album && (item.album.name || item.album.title)) || meta.album_title || "";
  let artist = meta.artist_name || "";
  if (!artist && Array.isArray(item.artists)) {
    artist = item.artists.map((a) => a.name).filter(Boolean).join(", ");
  }
  if (!artist && item.artist && item.artist.name) artist = item.artist.name;
  const durationMs = Number(
    item.duration?.milliseconds || item.duration || meta.duration || 0
  );
  if (!base62 || !title) return null;
  return { uri, base62, hex: LF.base62ToHex(base62), title, artist, album, durationMs };
};
