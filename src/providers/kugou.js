LF.providers = LF.providers || {};

LF.providers.kugou = {
  id: "kugou",
  displayName: "KuGou",

  fetch: async function kugouFetch(track) {
    if (!track || !track.title) return null;
    const query = [track.title, track.artist].filter(Boolean).join(" ");
    const search = await LF.httpGet(
      "https://mobileservice.kugou.com/api/v3/search/song?keyword=" +
        encodeURIComponent(query) +
        "&page=1&pagesize=10"
    );
    const songs = search.json && search.json.data && search.json.data.info;
    if (!Array.isArray(songs) || !songs.length) return null;

    const best = LF.pickBest(
      track,
      songs.map(function (song) {
        const seconds = Number(song.duration) || 0;
        return {
          id: song.hash,
          title: song.songname || song.songname_original,
          artist: song.singername,
          album: song.album_name,
          durationMs: seconds > 10000 ? seconds : seconds * 1000,
          hash: song.hash,
        };
      })
    );
    if (!best || !best.hash) return null;

    const durationSec = Math.round((Number(best.durationMs) || Number(track.durationMs) || 0) / 1000);
    const kgHeaders = {
      "KG-RC": "1",
      "User-Agent": "KuGou2012-9020-ExpandSearchManager",
    };
    const listed = await LF.httpGet(
      "https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&lrctxt=1&keyword=" +
        encodeURIComponent(best.title || track.title) +
        "&hash=" + encodeURIComponent(best.hash) +
        "&timelength=" + encodeURIComponent(String(durationSec)),
      kgHeaders
    );
    const candidates = (listed.json && listed.json.candidates) || [];
    if (!Array.isArray(candidates) || !candidates.length) return null;

    const trackMs = Number(track.durationMs) || best.durationMs || 0;
    const chosen =
      candidates.find(function (item) {
        const dt = Math.abs((Number(item.duration) || 0) - trackMs);
        return !trackMs || dt <= 4000;
      }) || candidates[0];
    if (!chosen || !chosen.id || !chosen.accesskey) return null;

    const download = await LF.httpGet(
      "https://lyrics.kugou.com/download?ver=1&client=pc&fmt=lrc&charset=utf8&id=" +
        encodeURIComponent(chosen.id) +
        "&accesskey=" + encodeURIComponent(chosen.accesskey),
      kgHeaders
    );
    const content = download.json && download.json.content;
    if (!content) return null;
    return LF.lyricsFromLrc(LF.decodeBase64Utf8(content), chosen.id, "zh");
  },
};
