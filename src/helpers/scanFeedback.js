/** Shared scan success feedback — works on Android & iOS after `unlockScanAudio()` from a tap. */

let audioCtx = null;
let html5BeepEl = null;
let beepDataUrl = null;

/** Fast + strong: short rumble then rapid heavy pulses (~2.2s, browser-safe). */
// export const SCAN_SUCCESS_VIBRATE_MS = [320, 8, 420, 8, 420, 8, 420, 8, 420, 8, 420, 8, 420];
export const SCAN_SUCCESS_VIBRATE_MS = [500, 5, 500, 5, 500, 5, 500, 5, 500, 5, 500, 5, 500];

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

function uint8ToBase64(bytes) {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function buildBeepDataUrl(startFreq = 1900, endFreq = 900, durationMs = 200, volume = 1.0) {
  const sampleRate = 8000;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const progress = i / Math.max(numSamples - 1, 1);
    const freq = startFreq + (endFreq - startFreq) * progress;
    phase += (2 * Math.PI * freq) / sampleRate;
    const envelope = i < numSamples * 0.04 ? i / (numSamples * 0.04) : (numSamples - i) / (numSamples * 0.96);
    const sample = Math.sign(Math.sin(phase)) * volume * envelope * 32767;
    view.setInt16(44 + i * 2, sample, true);
  }

  return `data:audio/wav;base64,${uint8ToBase64(new Uint8Array(buffer))}`;
}

const BEEP_WAV_REVISION = 2;
let beepWavRevision = 0;

/** Single cache entry — `buildBeepDataUrl()` runs at most once per page load (safe for 10k+ scans). */
function getBeepDataUrl() {
  if (beepDataUrl && beepWavRevision === BEEP_WAV_REVISION) return beepDataUrl;
  beepWavRevision = BEEP_WAV_REVISION;
  beepDataUrl = buildBeepDataUrl();
  html5BeepEl = null;
  return beepDataUrl;
}

function ensureBeepDataUrlReady() {
  if (beepDataUrl) return;
  getBeepDataUrl();
}

if (typeof window !== "undefined") {
  queueMicrotask(ensureBeepDataUrlReady);
}

/** Call synchronously from a user tap (open camera / scan button) so iOS allows sound later. */
export function unlockScanAudio() {
  if (typeof window === "undefined") return Promise.resolve();

  ensureBeepDataUrlReady();

  const ctx = getAudioContext();
  const tasks = [];

  if (ctx?.state === "suspended") {
    tasks.push(ctx.resume().catch(() => {}));
  }

  try {
    if (!html5BeepEl) {
      html5BeepEl = new Audio(getBeepDataUrl());
      html5BeepEl.preload = "auto";
      html5BeepEl.volume = 1;
    }
    html5BeepEl.muted = true;
    const primed = html5BeepEl.play();
    if (primed?.then) {
      tasks.push(
        primed
          .then(() => {
            html5BeepEl.pause();
            html5BeepEl.currentTime = 0;
            html5BeepEl.muted = false;
          })
          .catch(() => {
            html5BeepEl.muted = false;
          })
      );
    } else {
      html5BeepEl.muted = false;
    }
  } catch {
    /* ignore */
  }

  return Promise.all(tasks);
}

/** Camera warm-up cache — survives logout; not cleared by Redux persist purge. */
const CAMERA_PERM_UNTIL_KEY = "imp_app_camera_perm_until";
/** Legacy keys (daily cache) — removed when marking a new warm-up. */
const CAMERA_PERM_DAY_KEY_LEGACY = "imp_app_camera_perm_day";
const CAMERA_PERM_GRANTED_KEY_LEGACY = "imp_app_camera_perm_granted";
/** ~30 days — re-prompt at most once per month per browser (not every day). */
const CAMERA_PERM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function markCameraPermissionWarm() {
  try {
    const until = Date.now() + CAMERA_PERM_TTL_MS;
    localStorage.setItem(CAMERA_PERM_UNTIL_KEY, String(until));
    localStorage.removeItem(CAMERA_PERM_DAY_KEY_LEGACY);
    localStorage.removeItem(CAMERA_PERM_GRANTED_KEY_LEGACY);
  } catch {
    /* private mode / blocked storage */
  }
}

/** True when this browser already warmed camera within the last ~30 days. */
export function isCameraPermissionWarm() {
  try {
    const until = Number(localStorage.getItem(CAMERA_PERM_UNTIL_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

/** @deprecated Use {@link isCameraPermissionWarm} */
export function isCameraPermissionWarmForToday() {
  return isCameraPermissionWarm();
}

let cameraWarmInFlight = null;

/**
 * Ask for camera once per ~30 days (per browser), then reuse for QR scans.
 * Cache is kept across logout/login on the same device/browser.
 * Must run from a user tap (Scan button) before opening the scanner overlay.
 */
export async function warmUpCameraPermission() {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, unsupported: true };
  }

  if (isCameraPermissionWarm()) {
    return { ok: true, cached: true };
  }

  if (cameraWarmInFlight) return cameraWarmInFlight;

  cameraWarmInFlight = (async () => {
    try {
      if (navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: "camera" });
          if (status.state === "granted") {
            markCameraPermissionWarm();
            return { ok: true, cached: true };
          }
          if (status.state === "denied") {
            return { ok: false, denied: true };
          }
        } catch {
          /* Safari / older browsers — fall through to getUserMedia */
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      markCameraPermissionWarm();
      return { ok: true };
    } catch (err) {
      const denied =
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError" ||
        err?.name === "SecurityError";
      return { ok: false, denied };
    } finally {
      cameraWarmInFlight = null;
    }
  })();

  return cameraWarmInFlight;
}

/**
 * Call on Scan button click: prime beep audio + camera permission (~once per month).
 */
export async function prepareQrScanSession() {
  const [audioResult, cameraResult] = await Promise.all([
    unlockScanAudio(),
    warmUpCameraPermission(),
  ]);
  return {
    audioOk: !!audioResult,
    cameraOk: !!cameraResult?.ok,
    cameraDenied: !!cameraResult?.denied,
    cameraCached: !!cameraResult?.cached,
  };
}

function playOscillatorPulse(ctx, t0) {
  // const dur = 0.2;
  const dur = 0.4;
  const peakGain = 1.0;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(1900, t0);
  osc.frequency.exponentialRampToValueAtTime(900, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function playOscillatorBeep(ctx) {
  playOscillatorPulse(ctx, ctx.currentTime);
}

function playHtml5Beep() {
  if (typeof window === "undefined") return;
  try {
    ensureBeepDataUrlReady();
    if (!html5BeepEl) {
      html5BeepEl = new Audio(getBeepDataUrl());
      html5BeepEl.preload = "auto";
      html5BeepEl.volume = 1;
    }
    html5BeepEl.muted = false;
    html5BeepEl.currentTime = 0;
    const p = html5BeepEl.play();
    if (p?.catch) p.catch(() => {});
  } catch {
    /* ignore */
  }
}

function vibrateScanSuccess() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(SCAN_SUCCESS_VIBRATE_MS);
    }
  } catch {
    /* ignore */
  }
}

function isScanAudioPrimed() {
  const ctx = getAudioContext();
  return !!(ctx && ctx.state === "running" && html5BeepEl);
}

/** Short beep on successful QR scan (camera or validated manual add). */
export async function playScanSuccessBeep() {
  if (typeof window === "undefined") return;

  vibrateScanSuccess();

  if (!isScanAudioPrimed()) {
    await unlockScanAudio().catch(() => {});
  }

  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    await ctx.resume().catch(() => {});
  }

  let played = false;
  if (ctx?.state === "running") {
    try {
      playOscillatorBeep(ctx);
      played = true;
    } catch {
      /* fallback below */
    }
  }

  if (!played) {
    playHtml5Beep();
  }
}
