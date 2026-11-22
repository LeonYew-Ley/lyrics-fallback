LF.settings = LF.settings || {};

LF.sampleTrack = function sampleTrack() {
  const sample = LF.config.sampleTrack || {
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    durationMs: 200000,
  };
  return {
    title: sample.title,
    artist: sample.artist || "",
    album: sample.album || "",
    durationMs: Number(sample.durationMs) || 0,
    uri: "",
    base62: "",
    hex: "",
  };
};

LF.trackForLatencyTest = function trackForLatencyTest() {
  return LF.currentTrack() || LF.sampleTrack();
};

LF.withTimeout = function withTimeout(promise, ms) {
  const timeoutMs = Number(ms) || 15000;
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(new Error("timeout after " + timeoutMs + "ms"));
    }, timeoutMs);
    promise.then(
      function (value) {
        clearTimeout(timer);
        resolve(value);
      },
      function (err) {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
};

LF.lyricsStatus = function lyricsStatus(raw) {
  if (!raw) return "miss";
  const payload = LF.toColorLyrics(raw, { displayName: "test" });
  if (!payload) return "miss";
  if (payload.lyrics && payload.lyrics.syncType === "LINE_SYNCED") return "synced";
  return "unsynced";
};

LF.testProviderLatency = async function testProviderLatency(provider, track) {
  const started = performance.now();
  let raw = null;
  let error = null;
  try {
    raw = await LF.withTimeout(provider.fetch(track), LF.config.latencyTimeoutMs || 15000);
  } catch (err) {
    error = String(err && err.message ? err.message : err);
    raw = null;
  }
  const ms = Math.round(performance.now() - started);
  const status = error ? "error" : LF.lyricsStatus(raw);
  return {
    id: provider.id,
    displayName: provider.displayName || provider.id,
    ms: ms,
    status: status,
    error: error,
  };
};

LF.testAllProvidersLatency = async function testAllProvidersLatency(onProgress) {
  const current = LF.currentTrack();
  const track = current || LF.sampleTrack();
  const providers = LF.providers.enabled();
  const results = [];
  await Promise.all(
    providers.map(function (provider) {
      return LF.testProviderLatency(provider, track).then(function (result) {
        results.push(result);
        if (onProgress) onProgress(result, results.slice(), track, !current);
        return result;
      });
    })
  );
  return { track: track, usedSample: !current, results: results };
};

LF.settings.el = function settingsEl(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (key) {
      const value = attrs[key];
      if (value == null || value === false) return;
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key.indexOf("on") === 0 && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === "disabled") node.disabled = !!value;
      else node.setAttribute(key, value === true ? "" : String(value));
    });
  }
  (children || []).forEach(function (child) {
    if (child == null) return;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  });
  return node;
};

LF.settings.statusLabel = function statusLabel(status) {
  if (status === "synced") return LF.t("statusSynced");
  if (status === "unsynced") return LF.t("statusUnsynced");
  if (status === "error") return LF.t("statusError");
  if (status === "testing") return LF.t("statusTesting");
  return LF.t("statusMiss");
};

LF.settings.trackLabel = function trackLabel(track) {
  if (!track) return LF.t("noTrack");
  const name = [track.title, track.artist].filter(Boolean).join(" — ");
  return LF.t("currentTrack", { name: name });
};

LF.settings.isDefaultOrder = function isDefaultOrder(ids) {
  const current = ids || LF.config.providers || [];
  const def = LF.defaultProviders();
  if (current.length !== def.length) return false;
  for (let i = 0; i < def.length; i++) {
    if (current[i] !== def[i]) return false;
  }
  return true;
};

LF.settings.updateResetButton = function updateResetButton() {
  const button = LF.settings.resetButton;
  if (!button) return;
  const custom = !LF.settings.isDefaultOrder();
  button.hidden = false;
  button.style.display = "inline-flex";
  button.style.visibility = custom ? "visible" : "hidden";
  button.style.pointerEvents = custom ? "auto" : "none";
  button.setAttribute("aria-hidden", custom ? "false" : "true");
  if (custom) button.removeAttribute("tabindex");
  else button.setAttribute("tabindex", "-1");
};

LF.settings.updateTrackLine = function updateTrackLine() {
  const line = LF.settings.trackLine;
  if (!line) return;
  line.textContent = LF.settings.trackLabel(LF.currentTrack());
};

LF.settings.watchTrackLabel = function watchTrackLabel() {
  if (LF.settings._trackTimer) {
    clearInterval(LF.settings._trackTimer);
    LF.settings._trackTimer = null;
  }
  const tick = function tick() {
    const line = LF.settings.trackLine;
    if (!line || !line.isConnected) {
      if (LF.settings._trackTimer) {
        clearInterval(LF.settings._trackTimer);
        LF.settings._trackTimer = null;
      }
      return;
    }
    LF.settings.updateTrackLine();
  };
  tick();
  LF.settings._trackTimer = setInterval(tick, 1000);
};

LF.settings.renumber = function renumber(host) {
  const rows = host.querySelectorAll(".lf-settings-row");
  for (let i = 0; i < rows.length; i++) {
    const index = rows[i].querySelector(".lf-settings-index");
    if (index) index.textContent = String(i + 1);
  }
};

LF.settings.dragHandle = function dragHandle() {
  return LF.settings.el("span", {
    className: "lf-settings-handle",
    title: LF.t("dragHandle"),
    "aria-label": LF.t("dragHandle"),
    html:
      '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="3" r="1.15" fill="currentColor"/><circle cx="11" cy="3" r="1.15" fill="currentColor"/><circle cx="5" cy="8" r="1.15" fill="currentColor"/><circle cx="11" cy="8" r="1.15" fill="currentColor"/><circle cx="5" cy="13" r="1.15" fill="currentColor"/><circle cx="11" cy="13" r="1.15" fill="currentColor"/></svg>',
  });
};

LF.settings.bindDrag = function bindDrag(row, host) {
  const onDown = function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    if (LF.settings.dragging) return;
    e.preventDefault();
    e.stopPropagation();
    LF.settings.startDrag(row, host, e);
  };
  row.addEventListener("pointerdown", onDown);
};

LF.settings.disposeWarmDrag = function disposeWarmDrag() {
  const leftover = document.querySelectorAll(".lf-settings-row-ghost");
  for (let i = 0; i < leftover.length; i++) {
    if (leftover[i].parentNode) leftover[i].parentNode.removeChild(leftover[i]);
  }
  LF.settings._warmGhost = null;
};

LF.settings.warmDrag = function warmDrag(host) {
  host = host || LF.settings.listHost;
  if (!host || !host.isConnected) return;
  const rows = Array.from(host.querySelectorAll(".lf-settings-row"));
  if (!rows.length) return;

  for (let i = 0; i < rows.length; i++) {
    rows[i].style.willChange = "transform";
    rows[i].style.transition = "none";
    rows[i].style.transform = "translate3d(0,0,0)";
  }
  for (let i = 0; i < rows.length; i++) rows[i].getBoundingClientRect();
  void host.offsetHeight;
  for (let i = 0; i < rows.length; i++) {
    rows[i].style.transition = "transform 100ms ease";
    rows[i].style.transform = "";
  }
  void host.offsetHeight;

  // Warm the ghost compositor path, then remove it. Never leave a parked
  // ghost in the document (especially not at 0,0 or with a transform transition).
  LF.settings.disposeWarmDrag();
  const sample = rows[0];
  const rect = sample.getBoundingClientRect();
  const probe = sample.cloneNode(true);
  probe.classList.add("lf-settings-row-ghost");
  probe.style.transition = "none";
  probe.style.opacity = "0";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.width = rect.width + "px";
  probe.style.height = rect.height + "px";
  probe.style.transform = "translate3d(" + rect.left + "px," + rect.top + "px,0)";
  document.body.appendChild(probe);
  void probe.offsetHeight;
  if (probe.parentNode) probe.parentNode.removeChild(probe);
  LF.settings._warmGhost = null;

  requestAnimationFrame(function () {
    if (!LF.settings.dragging) LF.settings.clearRowTransforms(host);
  });
};

// Snap a drag ghost to a viewport position with transitions forced off so
// the first visible frame is already under the pointer, never flying from 0,0.
LF.settings.mountDragGhost = function mountDragGhost(row, left, top, width, height) {
  const ghost = row.cloneNode(true);
  ghost.classList.add("lf-settings-row-ghost");
  ghost.style.transition = "none";
  ghost.style.opacity = "0";
  ghost.style.visibility = "hidden";
  ghost.style.width = width + "px";
  ghost.style.height = height + "px";
  ghost.style.transform = "translate3d(" + left + "px," + top + "px,0)";
  document.body.appendChild(ghost);
  void ghost.getBoundingClientRect();
  ghost.style.visibility = "visible";
  ghost.style.opacity = "";
  return ghost;
};

LF.settings.clearRowTransforms = function clearRowTransforms(host) {
  const rows = host.querySelectorAll(".lf-settings-row");
  for (let i = 0; i < rows.length; i++) {
    rows[i].style.transition = "";
    rows[i].style.transform = "";
  }
};

// Preview a new hover index by translating siblings only. DOM order stays put
// until drop. Geometry comes from slots cached at pointerdown.
LF.settings.applyDragShifts = function applyDragShifts(rows, slots, from, to, dragged) {
  const n = rows.length;
  const visual = rows.slice();
  const moved = visual.splice(from, 1)[0];
  visual.splice(to, 0, moved);
  const destOf = new Map();
  for (let i = 0; i < visual.length; i++) destOf.set(visual[i], i);

  for (let i = 0; i < n; i++) {
    const item = rows[i];
    const dest = destOf.get(item);
    const idxEl = item.querySelector(".lf-settings-index");
    if (idxEl) idxEl.textContent = String(dest + 1);
    if (item === dragged) {
      item.style.transition = "none";
      item.style.transform = "";
      continue;
    }
    const dy = slots[dest].top - slots[i].top;
    item.style.transition = "transform 100ms ease";
    item.style.transform = dy ? "translate3d(0," + dy + "px,0)" : "translate3d(0,0,0)";
  }
  return visual;
};

LF.settings.commitDragOrder = function commitDragOrder(host, visual) {
  for (let i = 0; i < visual.length; i++) {
    visual[i].style.transition = "none";
  }
  for (let i = 0; i < visual.length; i++) {
    host.appendChild(visual[i]);
  }
  LF.settings.clearRowTransforms(host);
  LF.settings.renumber(host);
};

LF.settings.startDrag = function startDrag(row, host, event) {
  LF.settings.dragging = true;
  const rows = Array.from(host.querySelectorAll(".lf-settings-row"));
  const rect = row.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const originIndex = rows.indexOf(row);

  const firstBox = rows[0].getBoundingClientRect();
  const gap = rows.length > 1 ? rows[1].getBoundingClientRect().top - (firstBox.top + firstBox.height) : 6;
  const slots = [];
  let slotTop = firstBox.top;
  for (let i = 0; i < rows.length; i++) {
    const box = i === 0 ? firstBox : rows[i].getBoundingClientRect();
    const height = box.height;
    slots.push({ top: slotTop, height: height, mid: slotTop + height / 2 });
    slotTop += height + gap;
  }
  let overIndex = originIndex;
  let visual = rows.slice();

  if (LF.settings._warmGhost) LF.settings.disposeWarmDrag();
  const ghost = LF.settings.mountDragGhost(row, rect.left, rect.top, rect.width, rect.height);
  LF.settings.dragGhost = ghost;

  const moveGhost = function moveGhost(clientX, clientY) {
    ghost.style.transition = "none";
    ghost.style.transform = "translate3d(" + (clientX - offsetX) + "px," + (clientY - offsetY) + "px,0)";
  };
  row.classList.add("lf-settings-row-dragging");
  host.classList.add("lf-settings-list-dragging");

  const indexFromY = function indexFromY(y) {
    let next = slots.length - 1;
    for (let i = 0; i < slots.length; i++) {
      if (y < slots[i].mid) {
        next = i;
        break;
      }
    }
    return next;
  };

  const setPreview = function setPreview(nextIndex) {
    overIndex = nextIndex;
    visual = LF.settings.applyDragShifts(rows, slots, originIndex, overIndex, row);
    const ghostIdx = ghost.querySelector(".lf-settings-index");
    if (ghostIdx) ghostIdx.textContent = String(overIndex + 1);
  };

  let pendingX = event.clientX;
  let pendingY = event.clientY;
  let raf = 0;

  const tick = function tick() {
    raf = 0;
    moveGhost(pendingX, pendingY);
    const next = indexFromY(pendingY);
    if (next !== overIndex) setPreview(next);
  };

  const onMove = function onMove(ev) {
    ev.preventDefault();
    pendingX = ev.clientX;
    pendingY = ev.clientY;
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const finish = function finish() {
    if (!LF.settings.dragging) return;
    LF.settings.dragging = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    moveGhost(pendingX, pendingY);
    const next = indexFromY(pendingY);
    if (next !== overIndex) setPreview(next);

    row.classList.remove("lf-settings-row-dragging");
    host.classList.remove("lf-settings-list-dragging");
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    LF.settings.dragGhost = null;

    LF.settings.commitDragOrder(host, visual);

    const saved = LF.settings.latencyById || {};
    for (let i = 0; i < visual.length; i++) {
      const id = visual[i].getAttribute("data-provider-id");
      if (id && saved[id]) LF.settings.setRowResult(id, saved[id]);
    }

    document.removeEventListener("pointermove", onMove, true);
    document.removeEventListener("pointerup", finish, true);
    document.removeEventListener("pointercancel", finish, true);
    const ids = visual.map(function (item) {
      return item.getAttribute("data-provider-id");
    });
    const prev = (LF.config.providers || []).slice();
    let changed = ids.length !== prev.length;
    if (!changed) {
      for (let i = 0; i < ids.length; i++) {
        if (ids[i] !== prev[i]) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;
    setTimeout(function () {
      LF.saveProviderOrder(ids);
      LF.settings.updateResetButton();
    }, 0);
  };

  document.addEventListener("pointermove", onMove, true);
  document.addEventListener("pointerup", finish, true);
  document.addEventListener("pointercancel", finish, true);
};

LF.settings.rowForProvider = function rowForProvider(id) {
  const host = LF.settings.listHost;
  if (!host || !id) return null;
  return host.querySelector('.lf-settings-row[data-provider-id="' + id + '"]');
};

LF.settings.setRowResult = function setRowResult(id, result) {
  LF.settings.latencyById = LF.settings.latencyById || {};
  if (result) LF.settings.latencyById[id] = result;
  else delete LF.settings.latencyById[id];
  const row = LF.settings.rowForProvider(id);
  if (!row) return;
  const slot = row.querySelector(".lf-settings-result");
  if (!slot) return;
  slot.textContent = "";
  if (!result) return;
  if (result.status === "testing") {
    slot.appendChild(
      LF.settings.el("span", { className: "lf-settings-spinner", "aria-label": LF.t("statusTesting") })
    );
    return;
  }
  const klass = result.status === "synced" ? "lf-settings-ok" : "lf-settings-miss";
  const status = LF.settings.el("span", {
    className: "lf-settings-result-status " + klass,
    text: LF.settings.statusLabel(result.status),
  });
  if (result.status === "error" && result.error) status.title = result.error;
  slot.appendChild(
    LF.settings.el("span", {
      className: "lf-settings-result-ms",
      text: result.ms == null ? "—" : result.ms + " ms",
    })
  );
  slot.appendChild(status);
};

LF.settings.clearRowResults = function clearRowResults() {
  LF.settings.latencyById = {};
  const host = LF.settings.listHost;
  if (!host) return;
  const rows = host.querySelectorAll(".lf-settings-row");
  for (let i = 0; i < rows.length; i++) {
    LF.settings.setRowResult(rows[i].getAttribute("data-provider-id"), null);
  }
};

LF.settings.renderList = function renderList(host) {
  host.textContent = "";
  const ids = (LF.config.providers || []).slice();
  const saved = LF.settings.latencyById || {};
  ids.forEach(function (id, index) {
    const provider = LF.providers._byId[id];
    const name = (provider && provider.displayName) || id;
    const row = LF.settings.el("div", { className: "lf-settings-row", "data-provider-id": id }, [
      LF.settings.dragHandle(),
      LF.settings.el("span", { className: "lf-settings-index", text: String(index + 1) }),
      LF.settings.el("span", { className: "lf-settings-name", text: name }),
      LF.settings.el("span", { className: "lf-settings-result", "aria-live": "polite" }),
    ]);
    LF.settings.bindDrag(row, host);
    host.appendChild(row);
    if (saved[id]) LF.settings.setRowResult(id, saved[id]);
  });
};

LF.settings.reset = function resetSettingsOrder() {
  LF.resetProviderOrder();
  setTimeout(function () {
    if (LF.settings.listHost) LF.settings.renderList(LF.settings.listHost);
    LF.settings.updateResetButton();
  }, 0);
};

LF.settings.runLatencyTest = async function runLatencyTest() {
  if (LF.settings.testing) return;
  LF.settings.testing = true;
  if (LF.settings.testButton) {
    LF.settings.testButton.disabled = true;
    LF.settings.testButton.textContent = LF.t("testing");
  }
  const current = LF.currentTrack();
  const track = current || LF.sampleTrack();
  LF.settings.updateTrackLine();
  LF.settings.clearRowResults();
  const providers = LF.providers.enabled();
  for (let i = 0; i < providers.length; i++) {
    LF.settings.setRowResult(providers[i].id, { status: "testing" });
  }
  try {
    const results = await Promise.all(
      providers.map(function (provider) {
        return LF.testProviderLatency(provider, track).then(function (result) {
          LF.settings.setRowResult(provider.id, result);
          return result;
        });
      })
    );
    return results;
  } catch (err) {
    LF.log("latency test failed", String(err));
  } finally {
    LF.settings.testing = false;
    if (LF.settings.testButton) {
      LF.settings.testButton.disabled = false;
      LF.settings.testButton.textContent = LF.t("testButton");
    }
  }
};

LF.settings.disableOverlayDismiss = function disableOverlayDismiss() {
  const modal = document.querySelector("body > generic-modal");
  if (!modal) return false;
  const overlay = modal.querySelector(".GenericModal__overlay");
  if (!overlay || overlay.getAttribute("data-lf-stay-open") === "1") return !!overlay;
  const next = overlay.cloneNode(false);
  next.setAttribute("data-lf-stay-open", "1");
  while (overlay.firstChild) next.appendChild(overlay.firstChild);
  if (overlay.parentNode) overlay.parentNode.replaceChild(next, overlay);
  const closeBtn = modal.querySelector(".spicetify-popup-closeBtn, .main-trackCreditsModal-closeBtn");
  if (closeBtn && typeof modal.hide === "function") {
    closeBtn.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      LF.settings.disposeWarmDrag();
      modal.hide();
    };
  }
  return true;
};

LF.settings.build = function buildSettings() {
  const root = LF.settings.el("div", { className: "lf-settings" });
  const style = document.createElement("style");
  style.textContent = [
    ".lf-settings { color: var(--text-base, #fff); font-size: 14px; line-height: 1.5; }",
    ".lf-settings p, .lf-settings .lf-settings-note, .lf-settings .lf-settings-sub { margin: 0 0 12px; color: var(--text-subdued, #b3b3b3); }",
    ".lf-settings .lf-settings-sub { margin: 0 0 10px; font-size: 13px; }",
    ".lf-settings-heading { display: flex; align-items: center; gap: 8px; margin: 4px 0 4px; }",
    ".lf-settings-heading h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-base, #fff); }",
    ".lf-settings-heading .lf-settings-primary { margin-left: auto; }",
    ".lf-settings-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin: 0 0 6px; border-radius: 8px; background: rgba(255,255,255,0.08); cursor: grab; user-select: none; touch-action: none; will-change: transform; }",
    ".lf-settings-row-dragging { visibility: hidden; cursor: grabbing; }",
    ".lf-settings-row-ghost { position: fixed; left: 0; top: 0; z-index: 10000; margin: 0; box-sizing: border-box; pointer-events: none; opacity: 0.96; cursor: grabbing; box-shadow: 0 12px 28px rgba(0,0,0,0.45); will-change: transform; transition: none !important; }",
    ".lf-settings-handle { display: inline-flex; align-items: center; justify-content: center; width: 20px; color: var(--text-subdued, #b3b3b3); pointer-events: none; }",
    ".lf-settings-index { width: 1.5em; color: var(--text-subdued, #b3b3b3); }",
    ".lf-settings-name { flex: 1 1 auto; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".lf-settings button { border: 0; border-radius: 16px; padding: 6px 12px; cursor: pointer; background: rgba(255,255,255,0.12); color: var(--text-base, #fff); font-size: 13px; }",
    ".lf-settings button:hover:not(:disabled) { background: rgba(255,255,255,0.2); }",
    ".lf-settings button:disabled { opacity: 0.4; cursor: not-allowed; }",
    ".lf-settings-reset-slot { flex: 0 0 32px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }",
    ".lf-settings button.lf-settings-reset { display: inline-flex; width: 32px; height: 32px; padding: 0; border-radius: 50%; align-items: center; justify-content: center; flex: 0 0 auto; overflow: hidden; box-sizing: border-box; background: rgba(255,255,255,0.08); color: var(--text-subdued, #b3b3b3); }",
    ".lf-settings button.lf-settings-reset svg { width: 20px; height: 20px; display: block; overflow: hidden; flex: 0 0 auto; }",
    ".lf-settings button.lf-settings-reset:hover:not(:disabled) { background: rgba(255,255,255,0.2); color: var(--text-base, #fff); }",
    ".lf-settings-primary { background: #1ed760 !important; color: #000 !important; font-weight: 700; }",
    ".lf-settings-result { flex: 0 0 11.5rem; width: 11.5rem; min-height: 16px; display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px; font-size: 12px; line-height: 1.2; white-space: nowrap; pointer-events: none; }",
    ".lf-settings-result-ms { color: var(--text-subdued, #b3b3b3); font-variant-numeric: tabular-nums; }",
    ".lf-settings-ok { color: #1ed760; }",
    ".lf-settings-miss { color: var(--text-subdued, #b3b3b3); }",
    ".lf-settings-spinner { box-sizing: border-box; width: 14px; height: 14px; flex: 0 0 14px; border: 2px solid rgba(255,255,255,0.22); border-top-color: #1ed760; border-radius: 50%; animation: lf-settings-spin 0.7s linear infinite; }",
    "@keyframes lf-settings-spin { to { transform: rotate(360deg); } }",
  ].join("\n");
  root.appendChild(style);
  root.appendChild(
    LF.settings.el("p", {
      text: LF.t("intro"),
    })
  );

  const reset = LF.settings.el("button", {
    type: "button",
    className: "lf-settings-reset",
    title: LF.t("resetTitle"),
    "aria-label": LF.t("resetTitle"),
    html:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.15-6.75"></path><polyline points="21 3 21 9 15 9"></polyline></svg>',
    onClick: function () {
      LF.settings.reset();
    },
  });
  LF.settings.resetButton = reset;
  const resetSlot = LF.settings.el("div", { className: "lf-settings-reset-slot" }, [reset]);
  LF.settings.resetSlot = resetSlot;

  const testButton = LF.settings.el("button", {
    type: "button",
    className: "lf-settings-primary",
    text: LF.t("testButton"),
    onClick: function () {
      LF.settings.runLatencyTest();
    },
  });
  LF.settings.testButton = testButton;

  const heading = LF.settings.el("div", { className: "lf-settings-heading" }, [
    LF.settings.el("h3", { text: LF.t("orderHeading") }),
    resetSlot,
    testButton,
  ]);
  root.appendChild(heading);

  const trackLine = LF.settings.el("p", {
    className: "lf-settings-sub",
    text: LF.settings.trackLabel(LF.currentTrack()),
  });
  LF.settings.trackLine = trackLine;
  root.appendChild(trackLine);
  LF.settings.updateResetButton();

  const listHost = LF.settings.el("div", { className: "lf-settings-list" });
  LF.settings.listHost = listHost;
  LF.settings.renderList(listHost);
  root.appendChild(listHost);
  LF.settings.statusLine = null;
  return root;
};

LF.openSettings = function openSettings() {
  if (!window.Spicetify || !Spicetify.PopupModal) {
    LF.log("PopupModal unavailable");
    return false;
  }
  if (LF.settings._opening) return true;
  LF.settings._opening = true;
  setTimeout(function () {
    LF.settings._opening = false;
    try {
      LF.loadProviderOrder();
    } catch (_) {}
    LF.settings.disposeWarmDrag();
    const root = LF.settings.build();
    Spicetify.PopupModal.display({
      title: LF.t("appName"),
      content: root,
      isLarge: true,
    });
    LF.settings.disableOverlayDismiss();
    LF.settings.watchTrackLabel();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        LF.settings.warmDrag(LF.settings.listHost);
      });
    });
  }, 60);
  return true;
};

LF.installSettingsMenu = function installSettingsMenu() {
  if (LF.debug.settingsMenu) return true;
  if (!window.Spicetify || !Spicetify.Menu || !Spicetify.Menu.Item || !Spicetify.PopupModal) {
    return false;
  }
  try {
    const item = new Spicetify.Menu.Item(LF.t("appName"), false, function () {
      LF.openSettings();
    });
    item.register();
    LF.debug.settingsMenu = item;
    LF.log("settings menu registered");
    return true;
  } catch (err) {
    LF.log("settings menu failed", String(err));
    return false;
  }
};

LF.ensureSettingsMenu = function ensureSettingsMenu(attempt) {
  if (LF.installSettingsMenu()) return;
  const n = Number(attempt) || 0;
  if (n > 40) {
    LF.log("settings menu gave up waiting for Spicetify.Menu");
    return;
  }
  setTimeout(function () {
    LF.ensureSettingsMenu(n + 1);
  }, 250);
};
