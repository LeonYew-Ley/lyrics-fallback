LF.httpGet = async function httpGet(url, headers) {
  const hdrs = Object.assign({ Accept: "application/json, text/plain, */*" }, headers || {});

  const parse = function parseBody(text) {
    if (text == null) return null;
    const trimmed = String(text).trim();
    if (!trimmed) return null;
    const start = trimmed.indexOf("{") >= 0 && (trimmed.indexOf("[") < 0 || trimmed.indexOf("{") < trimmed.indexOf("["))
      ? trimmed.indexOf("{")
      : trimmed.indexOf("[");
    const jsonText = start > 0 ? trimmed.slice(start) : trimmed;
    try {
      return JSON.parse(jsonText);
    } catch (_) {
      return null;
    }
  };

  try {
    const res = await fetch(url, { headers: hdrs });
    const text = await res.text();
    const json = parse(text);
    if (res.ok) return { ok: true, status: res.status, text: text, json: json };
    if (res.status > 0) return { ok: false, status: res.status, text: text, json: json };
  } catch (err) {
    LF.log("fetch failed", url, String(err));
  }

  if (window.Spicetify && Spicetify.CosmosAsync && typeof Spicetify.CosmosAsync.get === "function") {
    try {
      const body = await Spicetify.CosmosAsync.get(url, null, hdrs);
      if (body && typeof body === "object") return { ok: true, status: 200, text: "", json: body };
      const text = body == null ? "" : String(body);
      const json = parse(text);
      return { ok: !!json || !!text, status: 200, text: text, json: json };
    } catch (err) {
      LF.log("cosmos failed", url, String(err));
    }
  }

  return { ok: false, status: 0, text: "", json: null };
};

LF.decodeBase64Utf8 = function decodeBase64Utf8(value) {
  try {
    const binary = atob(String(value || "").replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch (_) {
    return "";
  }
};
