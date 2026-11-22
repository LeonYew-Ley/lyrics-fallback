LF.providers = LF.providers || {};

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

  search: async function lrclibSearch(query, durationMs) {
    const params = new URLSearchParams({
      track_name: query.title,
      artist_name: query.artist || "",
    });
    const res = await fetch(this.searchUrl + "?" + params.toString(), {
      headers: { "x-user-agent": LF.config.userAgent },
    });
    if (res.status !== 200) return null;
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) return null;
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
    return null;
  },
};
