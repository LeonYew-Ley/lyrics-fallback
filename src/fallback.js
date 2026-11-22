LF.cache = new Map();
LF.inflight = new Map();

LF.cacheGet = function cacheGet(id) {
  const ids = LF.normalizeId(id);
  return (
    (ids.base62 && LF.cache.get(ids.base62)) ||
    (ids.hex && LF.cache.get(ids.hex)) ||
    (ids.raw && LF.cache.get(ids.raw)) ||
    null
  );
};

LF.cacheSet = function cacheSet(id, value) {
  const ids = LF.normalizeId(id);
  if (ids.base62) LF.cache.set(ids.base62, value);
  if (ids.hex) LF.cache.set(ids.hex, value);
  if (ids.raw) LF.cache.set(ids.raw, value);
};

LF.lookupTrack = async function lookupTrack(track) {
  if (!track?.base62) return { status: "none" };
  const existing = LF.cacheGet(track.base62);
  if (existing && existing.status !== "pending") return existing;
  if (LF.inflight.has(track.base62)) return LF.inflight.get(track.base62);

  const job = (async () => {
    try {
      let payload = null;
      let provider = null;
      let raw = null;
      for (const candidate of LF.providers.enabled()) {
        try {
          raw = await candidate.fetch(track);
        } catch (err) {
          LF.log(candidate.id + " fetch failed", String(err));
          raw = null;
        }
        if (!raw) continue;
        payload = LF.toColorLyrics(raw, candidate);
        if (payload) {
          provider = candidate;
          break;
        }
      }
      if (!payload) {
        const miss = { status: "none", payload: null, track };
        LF.cacheSet(track.base62, miss);
        LF.log("fallback none", { id: track.base62, title: track.title });
        return miss;
      }
      const hit = {
        status: "hit",
        payload,
        track,
        provider: provider.displayName || provider.id,
      };
      LF.cacheSet(track.base62, hit);
      LF.log("fallback hit", {
        id: track.base62,
        title: track.title,
        provider: hit.provider,
        syncType: payload.lyrics.syncType,
        lines: payload.lyrics.lines.length,
      });
      try {
        LF.injectQueryCache(track.uri, payload);
      } catch (err) {
        LF.log("inject after hit failed", String(err));
      }
      return hit;
    } catch (err) {
      const miss = { status: "none", payload: null, track };
      LF.cacheSet(track.base62, miss);
      LF.log("fallback error", String(err));
      return miss;
    } finally {
      LF.inflight.delete(track.base62);
    }
  })();

  LF.inflight.set(track.base62, job);
  return job;
};

LF.trackForRequestId = function trackForRequestId(id) {
  const cached = LF.cacheGet(id);
  if (cached?.track) return cached.track;
  const current = LF.currentTrack();
  if (!current) return null;
  const ids = LF.normalizeId(id);
  if (
    (ids.base62 && ids.base62 === current.base62) ||
    (ids.hex && ids.hex === current.hex)
  ) {
    return current;
  }
  return current;
};

LF.fallbackFor = async function fallbackFor(id) {
  const known = LF.cacheGet(id);
  if (known) return known;
  const track = LF.trackForRequestId(id);
  if (!track) return { status: "none", payload: null };
  return LF.lookupTrack(track);
};
