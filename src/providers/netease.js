LF.providers = LF.providers || {};

LF.providers.netease = {
  id: "netease",
  displayName: "NetEase",

  fetch: async function neteaseFetch(track) {
    if (!track || !track.title) return null;
    const query = [track.title, track.artist].filter(Boolean).join(" ");
    const search = await LF.httpGet(
      "https://music.163.com/api/search/get?s=" + encodeURIComponent(query) + "&type=1&limit=10&offset=0",
      { Referer: "https://music.163.com/", Origin: "https://music.163.com/" }
    );
    const songs = search.json && search.json.result && search.json.result.songs;
    if (!Array.isArray(songs) || !songs.length) return null;

    const best = LF.pickBest(
      track,
      songs.map(function (song) {
        return {
          id: song.id,
          title: song.name,
          artist: (song.artists || []).map(function (artist) { return artist.name; }).join(" "),
          album: song.album && song.album.name,
          durationMs: song.duration,
        };
      })
    );
    if (!best) return null;

    const lyric = await LF.httpGet(
      "https://music.163.com/api/song/lyric?id=" + encodeURIComponent(best.id) + "&lv=-1&kv=-1&tv=-1",
      { Referer: "https://music.163.com/", Origin: "https://music.163.com/" }
    );
    const body = lyric.json || {};
    return LF.lyricsFromLrc(body.lrc && body.lrc.lyric, best.id, "zh");
  },
};
