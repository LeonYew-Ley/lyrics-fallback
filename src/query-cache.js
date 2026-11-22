LF.looksLikeQueryClient = function looksLikeQueryClient(obj) {
  if (!obj || typeof obj !== "object") return null;
  try {
    if (
      typeof obj.setQueryData === "function" &&
      typeof obj.getQueryCache === "function" &&
      typeof obj.getQueryData === "function"
    ) {
      return obj;
    }
    if (obj.client && LF.looksLikeQueryClient(obj.client)) return obj.client;
  } catch (_) {}
  return null;
};

LF.findQueryClient = function findQueryClient() {
  if (LF.debug.queryClient && typeof LF.debug.queryClient.setQueryData === "function") {
    return LF.debug.queryClient;
  }
  const nodes = [];
  try {
    const selectors = ["#main", "#root", ".Root", "body > div", "[data-testid='root']"];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => nodes.push(el));
    }
    if (document.body) nodes.push(document.body);
  } catch (_) {}
  const fibers = [];
  for (const el of nodes) {
    try {
      for (const key of Object.keys(el)) {
        if (
          key.startsWith("__reactContainer$") ||
          key.startsWith("__reactFiber$") ||
          key.startsWith("__reactInternalInstance$")
        ) {
          fibers.push(el[key]);
        }
      }
    } catch (_) {}
  }
  const seen = new Set();
  const stack = fibers.slice();
  let hops = 0;
  while (stack.length && hops < 8000) {
    const fiber = stack.pop();
    hops++;
    if (!fiber || typeof fiber !== "object" || seen.has(fiber)) continue;
    seen.add(fiber);
    const buckets = [
      fiber.stateNode,
      fiber.memoizedState,
      fiber.memoizedProps,
      fiber.pendingProps,
      fiber.context,
    ];
    for (const bucket of buckets) {
      const qc = LF.looksLikeQueryClient(bucket);
      if (qc) {
        LF.debug.queryClient = qc;
        LF.log("found QueryClient");
        return qc;
      }
    }
    let state = fiber.memoizedState;
    let sh = 0;
    while (state && sh++ < 40) {
      const qc =
        LF.looksLikeQueryClient(state) ||
        LF.looksLikeQueryClient(state.memoizedState) ||
        LF.looksLikeQueryClient(state.queue && state.queue.shared);
      if (qc) {
        LF.debug.queryClient = qc;
        LF.log("found QueryClient via hook state");
        return qc;
      }
      try {
        state = state.next;
      } catch (_) {
        break;
      }
    }
    try {
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    } catch (_) {}
  }
  return LF.debug.queryClient || null;
};

LF.uriOfAvailabilityKey = function uriOfAvailabilityKey(key) {
  if (!Array.isArray(key) || key[0] !== "useLyricsAvailability") return null;
  return key[1] || null;
};

LF.uriOfLyricsKey = function uriOfLyricsKey(key) {
  if (!Array.isArray(key) || key[0] !== "lyrics") return null;
  const spec = key[1];
  if (spec && typeof spec === "object") return spec.uri || null;
  return null;
};

// Only write when official lyrics are absent. Official has_lyrics / color-lyrics win.
LF.injectQueryCache = function injectQueryCache(uri, payload) {
  if (!uri || !payload) return false;
  const qc = LF.findQueryClient();
  if (!qc) {
    LF.log("QueryClient not ready");
    return false;
  }
  const transformed = LF.toQueryLyrics(payload);
  let flipped = false;
  let wroteLyrics = 0;
  try {
    const queries = qc.getQueryCache().getAll();
    for (const query of queries) {
      const key = query.queryKey;
      const availUri = LF.uriOfAvailabilityKey(key);
      if (availUri === uri) {
        const current = query.state && query.state.data;
        if (current === true) {
          LF.debug.injected[uri] = LF.debug.injected[uri] || {};
          LF.debug.injected[uri].officialAvailability = true;
          continue;
        }
        qc.setQueryData(key, true);
        flipped = true;
      }
      const lyricsUri = LF.uriOfLyricsKey(key);
      if (lyricsUri === uri) {
        const current = query.state && query.state.data;
        if (LF.isOfficialCachedLyrics(current)) {
          LF.debug.injected[uri] = LF.debug.injected[uri] || {};
          LF.debug.injected[uri].officialLyrics = true;
          continue;
        }
        // Same fallback provider: skip to avoid 1s poll flicker.
        // Different fallback provider (e.g. after a reorder + cache clear): overwrite.
        if (
          current &&
          current.hasLyrics &&
          LF.providers.isFallbackName(current.provider) &&
          String(current.provider || "") === String(transformed.provider || "")
        ) {
          continue;
        }
        qc.setQueryData(key, Object.assign({}, transformed));
        wroteLyrics++;
      }
    }
  } catch (err) {
    LF.log("query cache walk failed", String(err));
  }

  const official = !!(LF.debug.injected[uri] && LF.debug.injected[uri].officialAvailability);
  if (!official) {
    try {
      const existing = qc.getQueryData(["useLyricsAvailability", uri]);
      if (existing !== true) {
        qc.setQueryData(["useLyricsAvailability", uri], true);
        flipped = true;
      }
    } catch (err) {
      LF.log("set availability failed", String(err));
    }
  }

  LF.debug.injected[uri] = Object.assign({}, LF.debug.injected[uri], {
    flipped,
    wroteLyrics,
    at: Date.now(),
  });
  if (flipped || wroteLyrics) {
    LF.log("injected query cache", { uri, flipped, wroteLyrics });
  }
  return flipped || wroteLyrics > 0;
};

LF.syncCurrentIntoQueryCache = function syncCurrentIntoQueryCache() {
  const track = LF.currentTrack();
  if (!track) return;
  const hit = LF.cacheGet(track.base62);
  if (!hit || hit.status !== "hit") return;
  LF.injectQueryCache(track.uri, hit.payload);
};

LF.watchQueryCache = function watchQueryCache() {
  if (LF.debug.queryCacheWatching) return;
  const qc = LF.findQueryClient();
  if (!qc) return;
  try {
    qc.getQueryCache().subscribe(function () {
      try {
        LF.syncCurrentIntoQueryCache();
      } catch (_) {}
    });
    LF.debug.queryCacheWatching = true;
    LF.log("subscribed to QueryCache");
  } catch (err) {
    LF.log("QueryCache subscribe failed", String(err));
  }
};
