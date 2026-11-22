LF.B62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

LF.base62ToHex = function base62ToHex(id) {
  if (!id || id.length !== 22) return null;
  let n = 0n;
  for (let i = 0; i < id.length; i++) {
    const idx = LF.B62.indexOf(id[i]);
    if (idx < 0) return null;
    n = n * 62n + BigInt(idx);
  }
  return n.toString(16).padStart(32, "0");
};

LF.hexToBase62 = function hexToBase62(hex) {
  if (!hex || hex.length !== 32) return null;
  let n = BigInt("0x" + hex);
  if (n === 0n) return "0".repeat(22);
  let out = "";
  while (n > 0n) {
    const rem = Number(n % 62n);
    out = LF.B62[rem] + out;
    n = n / 62n;
  }
  return out.padStart(22, "0");
};

LF.normalizeId = function normalizeId(id) {
  if (!id) return {};
  if (/^[0-9a-f]{32}$/i.test(id)) {
    const hex = id.toLowerCase();
    return { hex, base62: LF.hexToBase62(hex) };
  }
  if (/^[0-9A-Za-z]{22}$/.test(id)) {
    return { base62: id, hex: LF.base62ToHex(id) };
  }
  return { raw: id };
};
