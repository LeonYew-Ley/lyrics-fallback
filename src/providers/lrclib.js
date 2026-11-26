LF.providers = LF.providers || {};

const lrclibTitleDurationDeltaMs = 2000;

const lrclibMatchKey = (value) =>
  LF.toSimplified(LF.normalizeText(value))
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "");

const lrclibTextMatches = (candidate, wanted) => {
  if (!candidate || !wanted) return false;
  return candidate === wanted || candidate.includes(wanted) || wanted.includes(candidate);
};

const lrclibResultTrack = (item) => ({
  title: item.trackName || item.name || "",
  artist: item.artistName || "",
  album: item.albumName || "",
  durationMs: Number(item.duration) * 1000,
});

const lrclibPickTitleCandidate = (track, items) => {
  const wantTitle = lrclibMatchKey(track.title);
  const wantArtist = lrclibMatchKey(track.artist);
  const wantAlbum = lrclibMatchKey(track.album);
  const trackMs = Number(track.durationMs) || 0;
  const trackIsLive = LF.isLiveOrRemix(track.title) || LF.isLiveOrRemix(track.album);
  const seen = new Set();
  const candidates = [];

  for (const item of items || []) {
    if (!item || item.instrumental || !String(item.syncedLyrics || "").trim()) continue;
    const candidate = lrclibResultTrack(item);
    const candidateMs = candidate.durationMs;
    if (!trackMs || !Number.isFinite(candidateMs) || candidateMs <= 0) continue;
    const durationDelta = Math.abs(candidateMs - trackMs);
    if (durationDelta > lrclibTitleDurationDeltaMs) continue;
    if (!trackIsLive && LF.isLiveOrRemix(candidate.title + " " + candidate.album)) continue;

    const title = lrclibMatchKey(candidate.title);
    if (!lrclibTextMatches(title, wantTitle)) continue;

    const key = item.id != null
      ? String(item.id)
      : [candidate.title, candidate.artist, candidate.album, candidateMs].join("\0");
    if (seen.has(key)) continue;
    seen.add(key);

    const artist = lrclibMatchKey(candidate.artist);
    const album = lrclibMatchKey(candidate.album);
    const artistMatch = lrclibTextMatches(artist, wantArtist);
    const albumMatch = lrclibTextMatches(album, wantAlbum);
    const score =
      (artistMatch ? 60 : 0) +
      (albumMatch ? 40 : 0) +
      (title === wantTitle ? 20 : 0) +
      20 * (1 - durationDelta / lrclibTitleDurationDeltaMs);

    candidates.push({ item, score, durationDelta, artistMatch, albumMatch });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.durationDelta - b.durationDelta);
  const confident = candidates.filter((candidate) => candidate.artistMatch || candidate.albumMatch);
  if (confident.length) return confident[0].item;
  return candidates.length === 1 ? candidates[0].item : null;
};

LF.providers.lrclib = {
  id: "lrclib",
  displayName: "LRCLIB",
  getUrl: "https://lrclib.net/api/get",
  searchUrl: "https://lrclib.net/api/search",

  isUsable: function isUsableLrclib(data) {
    if (!data || data.instrumental) return false;
    if (data.syncedLyrics && String(data.syncedLyrics).trim()) return true;
    if (data.plainLyrics && String(data.plainLyrics).trim()) return true;
    return false;
  },

  queriesFor: function lrclibQueries(track) {
    const seen = new Set();
    const list = [];
    const add = function add(title, artist, album) {
      const key = [title, artist, album].join("\0");
      if (!title || seen.has(key)) return;
      seen.add(key);
      list.push({ title: title, artist: artist || "", album: album || "" });
    };
    add(track.title, track.artist, track.album);
    add(LF.toSimplified(track.title), LF.toSimplified(track.artist || ""), LF.toSimplified(track.album || ""));
    add(LF.coreTitle(track.title), LF.coreTitle(track.artist || ""), LF.coreTitle(track.album || ""));
    return list;
  },

  get: async function lrclibGet(query, durationMs) {
    const params = new URLSearchParams({
      track_name: query.title,
      artist_name: query.artist || "",
      album_name: query.album || "",
      duration: String((durationMs || 0) / 1000),
    });
    const res = await fetch(this.getUrl + "?" + params.toString(), {
      headers: { "x-user-agent": LF.config.userAgent },
    });
    if (res.status !== 200) return null;
    return res.json();
  },

  searchResults: async function lrclibSearchResults(query) {
    const params = new URLSearchParams({ track_name: query.title });
    if (query.artist) params.set("artist_name", query.artist);
    const res = await fetch(this.searchUrl + "?" + params.toString(), {
      headers: { "x-user-agent": LF.config.userAgent },
    });
    if (res.status !== 200) return [];
    const list = await res.json();
    return Array.isArray(list) ? list : [];
  },

  search: async function lrclibSearch(query, durationMs) {
    const list = await this.searchResults(query);
    if (!list.length) return null;
    const durationSec = (durationMs || 0) / 1000;
    const scored = list
      .map((item) => {
        const dt = Math.abs((item.duration || 0) - durationSec);
        return { item, dt };
      })
      .sort((a, b) => a.dt - b.dt);
    const best = scored[0];
    if (durationSec && best.dt > 4) {
      const named = list.find(
        (item) =>
          String(item.trackName || item.name || "").toLowerCase() === String(query.title || "").toLowerCase()
      );
      if (named) return named;
    }
    return best.item;
  },

  searchByTitle: async function lrclibSearchByTitle(track) {
    const queries = [];
    for (const title of [track.title, LF.coreTitle(track.title)]) {
      if (title && !queries.includes(title)) queries.push(title);
    }
    const seen = new Set();
    const items = [];
    for (const title of queries) {
      try {
        const list = await this.searchResults({ title });
        for (const item of list) {
          const key = item && item.id != null
            ? String(item.id)
            : [item && item.trackName, item && item.artistName, item && item.duration].join("\0");
          if (seen.has(key)) continue;
          seen.add(key);
          items.push(item);
        }
      } catch (err) {
        LF.log("lrclib title search failed", String(err));
      }
    }
    return lrclibPickTitleCandidate(track, items);
  },

  fetch: async function lrclibFetch(track) {
    if (!track || !track.title) return null;
    const queries = this.queriesFor(track);
    for (const query of queries) {
      let data = null;
      try {
        data = await this.get(query, track.durationMs);
      } catch (err) {
        LF.log("lrclib get failed", String(err));
        data = null;
      }
      if (!this.isUsable(data)) {
        try {
          data = await this.search(query, track.durationMs);
        } catch (err) {
          LF.log("lrclib search failed", String(err));
          data = null;
        }
      }
      if (this.isUsable(data)) return data;
    }
    return this.searchByTitle(track);
  },
};
