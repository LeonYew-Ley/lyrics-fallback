// Hook window.fetch and XMLHttpRequest only. Do not hook webpack SpotifyTransportRequest:
// walking or pushing dummy rspack chunks has crashed xpui.

LF.jsonResponse = function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

LF.hookXHR = function hookXHR() {
  if (!window.XMLHttpRequest || XMLHttpRequest.prototype.__lyricsFallbackHooked) return;
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { this.__lfUrl = url; } catch (_) {}
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    const xhr = this;
    const url = xhr.__lfUrl;
    const target = LF.idFromUrl(url);
    if (!target) return send.apply(xhr, arguments);
    xhr.addEventListener("readystatechange", function () {
      if (xhr.readyState !== 4) return;
      try {
        LF.log("xhr " + target.kind + " status=" + xhr.status, target.id);
      } catch (_) {}
    });
    return send.apply(xhr, arguments);
  };
  XMLHttpRequest.prototype.__lyricsFallbackHooked = true;
  LF.log("hooked XMLHttpRequest");
};

LF.hookFetch = function hookFetch() {
  if (!window.fetch || window.fetch.__lyricsFallbackHooked) return;
  const original = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    const target = LF.idFromUrl(url);
    if (!target) return original(input, init);
    if (target.kind === "color-lyrics") {
      const res = await original(input, init);
      if (res.ok) {
        const clone = res.clone();
        let body;
        try { body = await clone.json(); } catch (_) { return res; }
        if (LF.isOfficialColorBody(body)) return res;
        const fb = await LF.fallbackFor(target.id);
        if (fb.status === "hit") {
          LF.log("fetch color-lyrics replaced with " + (fb.provider || "fallback"), target.id);
          return LF.jsonResponse(fb.payload);
        }
        return res;
      }
      if (res.status === 404 || res.status === 204) {
        const fb = await LF.fallbackFor(target.id);
        if (fb.status === "hit") {
          LF.log("fetch color-lyrics 404, using " + (fb.provider || "fallback"), target.id);
          return LF.jsonResponse(fb.payload);
        }
      }
      return res;
    }
    if (target.kind === "metadata") {
      const res = await original(input, init);
      if (!res.ok) return res;
      const clone = res.clone();
      let body;
      try { body = await clone.json(); } catch (_) { return res; }
      if (LF.isOfficialMetadata(body)) return res;
      const fb = await LF.fallbackFor(target.id);
      if (fb.status === "hit") {
        LF.log("fetch metadata flipped has_lyrics=true", target.id);
        return LF.jsonResponse(Object.assign({}, body, { has_lyrics: true }));
      }
      return res;
    }
    return original(input, init);
  };
  window.fetch.__lyricsFallbackHooked = true;
  LF.log("hooked window.fetch");
};
