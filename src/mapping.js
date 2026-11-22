LF.timestampToMs = function timestampToMs(timestamp) {
  const cleaned = String(timestamp).replace(/[\[\]<>]/g, "");
  const parts = cleaned.split(":");
  if (parts.length < 2) return 0;
  const minutes = Number(parts[0]);
  const seconds = Number(parts.slice(1).join("."));
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return minutes * 60 * 1000 + seconds * 1000;
};

LF.parseLocalLyrics = function parseLocalLyrics(lyrics) {
  if (!lyrics || typeof lyrics !== "string") return { synced: null, unsynced: null };
  const lines = lyrics
    .replace(/\[[a-zA-Z]+:[^\]]*\]/g, "")
    .trim()
    .split(/\r?\n/);
  if (!lines.length) return { synced: null, unsynced: null };
  const syncedTimestamp = /\[([0-9:.]+)\]/;
  const unsynced = [];
  const hasTimestamp = lines.some((line) => syncedTimestamp.test(line));
  const synced = hasTimestamp ? [] : null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const time = line.match(syncedTimestamp)?.[1];
    const lyric = line
      .replace(/\[([0-9:.]+)\]/g, "")
      .replace(/<([0-9:.]+)>/g, "")
      .trim();
    if (!time && !lyric) continue;
    const text = lyric || "♪";
    if (hasTimestamp && time && synced) synced.push({ text, startTime: LF.timestampToMs(time) });
    unsynced.push({ text });
  }
  return {
    synced: synced && synced.length ? synced : null,
    unsynced: unsynced.length ? unsynced : null,
  };
};

// Convert provider lyrics (syncedLyrics / plainLyrics, same shape as LRCLIB) into
// Spotify's native color-lyrics JSON body.
LF.toColorLyrics = function toColorLyrics(data, provider) {
  const displayName = (provider && (provider.displayName || provider.id)) || "fallback";
  const parsed = data.syncedLyrics
    ? LF.parseLocalLyrics(data.syncedLyrics)
    : { synced: null, unsynced: LF.parseLocalLyrics(data.plainLyrics || "").unsynced };
  const synced = parsed.synced && parsed.synced.length ? parsed.synced : null;
  const unsynced =
    (parsed.unsynced && parsed.unsynced.length && parsed.unsynced) ||
    (synced && synced.map((line) => ({ text: line.text }))) ||
    null;
  if (!synced && !unsynced) return null;
  const rows = synced || unsynced;
  const lines = rows.map((line, i) => ({
    startTimeMs: String(synced ? line.startTime : 0),
    words: line.text,
    syllables: [],
    endTimeMs: String(synced && rows[i + 1] ? rows[i + 1].startTime : 0),
  }));
  return {
    lyrics: {
      syncType: synced ? "LINE_SYNCED" : "UNSYNCED",
      lines,
      provider: displayName,
      providerLyricsId: data.id != null ? String(data.id) : "",
      providerDisplayName: displayName,
      syncLyricsUri: "",
      isDenseTypeface: false,
      alternatives: [],
      language: data.language || "",
      isRtlLanguage: false,
      fullscreenAction: "FULLSCREEN_LYRICS",
      showUpsell: false,
      previewLines: lines.slice(0, 3),
      capStatus: undefined,
    },
    colors: {
      background: -9013642,
      text: -16777216,
      highlightText: -1,
    },
    hasVocalRemoval: false,
  };
};

// Shape expected by the native React Query lyrics hook (module 45461).
LF.toQueryLyrics = function toQueryLyrics(payload) {
  const lines = (payload && payload.lyrics && payload.lyrics.lines) || [];
  const mapped = lines.map((line, i) => {
    const start = Number(line.startTimeMs) || 0;
    const next = lines[i + 1];
    return {
      start,
      end: next && next.startTimeMs ? Number(next.startTimeMs) : Infinity,
      text: line.words,
    };
  });
  const syncType = payload.lyrics.syncType;
  return {
    hasLyrics: true,
    isTimeSynced: syncType === "LINE_SYNCED" || syncType === "SYLLABLE_SYNCED",
    syncType,
    lyrics: mapped,
    colors: {
      text: "rgb(0, 0, 0)",
      activeText: "rgb(255, 255, 255)",
      background: "rgb(118, 86, 118)",
    },
    dynamicColors: null,
    provider: payload.lyrics.provider,
    providerDisplayName: payload.lyrics.providerDisplayName,
    providerLyricsId: payload.lyrics.providerLyricsId,
    hasVocalRemoval: false,
    showUpsell: false,
    alternatives: payload.lyrics.alternatives || [],
    previewLines: mapped.slice(0, 3),
    capStatus: payload.lyrics.capStatus,
  };
};
