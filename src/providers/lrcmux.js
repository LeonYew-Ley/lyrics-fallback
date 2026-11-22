LF.providers = LF.providers || {};

LF.providers.lrcmux = {
  id: "lrcmux",
  displayName: "LRCMux",
  url: "https://api.lrcmux.dev/get",

  queriesFor: function lrcmuxQueries(track) {
    const seen = new Set();
    const list = [];
    const add = function add(title, artist, album) {
      const key = [title, artist, album].join("\0");
      if (!title || seen.has(key)) return;
      seen.add(key);
      list.push({ title: title, artist: artist || "", album: album || "" });
    };
    add(track.title, track.artist, track.album);
    if (LF.toSimplified) {
      add(LF.toSimplified(track.title), LF.toSimplified(track.artist || ""), LF.toSimplified(track.album || ""));
    }
    if (LF.coreTitle) {
      add(LF.coreTitle(track.title), LF.coreTitle(track.artist || ""), LF.coreTitle(track.album || ""));
    }
    return list;
  },

  fetch: async function lrcmuxFetch(track) {
    if (!track || !track.title) return null;
    const queries = this.queriesFor(track);
    const durationSec = Math.round((Number(track.durationMs) || 0) / 1000);
    for (const query of queries) {
      const params = new URLSearchParams({
        artist: query.artist || "",
        title: query.title,
        format: "lrc",
        level: "line",
        sources: "deezer,ytmusic",
      });
      if (query.album) params.set("album", query.album);
      if (durationSec) params.set("duration", String(durationSec));
      let res = null;
      try {
        res = await LF.httpGet(this.url + "?" + params.toString(), {
          "User-Agent": LF.config.userAgent,
        });
      } catch (err) {
        LF.log("lrcmux fetch failed", String(err));
        res = null;
      }
      if (!res || !res.ok || !res.text) continue;
      const parsed = LF.lyricsFromLrc(res.text, query.title, "");
      if (parsed) return parsed;
    }
    return null;
  },
};
