// Real art assets (PR #4) wired into the game (PR: art-integration).
// Keyframes from assets/dogs/ replace the programmatic placeholders in
// js/sprites.js. Layers from assets/dogs/layers/ are bright-green
// (#00FF00) backgrounds: chroma-keyed to transparent at runtime, then
// scaled + anchored onto the keyframe. Layers are centered-large in
// their own frames, so they are NEVER pasted 1:1 over a keyframe.
//
// Deliberate limits (from assets/README.md, the manifest):
// - Gear layers are NOT overlaid: keyframes already bake the gear in
//   (crown, sword, cape...), so overlaying would double-draw it. The
//   exploded sheets (shadow-003-gear, fusion-f01-gear, light-003-gear
//   side-by-side sword+helmet) cannot be overlaid whole at all.
// - Halos ARE overlaid (they read as rings above the head) except
//   light-005-halo, whose layer also carries its cloud — overlaying it
//   would double the cloud, so light-005 keeps its baked halo.
// - fusion-f02 has no tail layer (body sway + halo + eye pulse instead).
// - hidden-h01 has no flower layer (keyframe only).
// - No ears layers exist anywhere, so no ear-flop animation.
// - shadow-005 / fusion-f03 nine tails are single fan layers: the whole
//   fan sways, individual tails cannot wiggle.
// - Tongues on light-004 / ice-003 are baked into the keyframes.
// - Any sprite or layer that fails to load falls back to the
//   programmatic placeholder (drawDogSprite) or to keyframe+bob —
//   never a broken image or a blank dog.
//
// Game rules and numbers are NOT touched here. This file only draws.
'use strict';

/* ---------------- sprite registry ---------------- */

// Breed + stage -> keyframe file. All 23 keyframes are mapped so later
// stages work without another loader change; the MVP flow only reaches
// stages 001-003 of the three breeds.
const ART_KEYFRAMES = {
  pomeranian: { 1: 'light-001', 2: 'light-002', 3: 'light-003', 4: 'light-004', 5: 'light-005' },
  husky: { 1: 'ice-001', 2: 'ice-002', 3: 'ice-003', 4: 'ice-004', 5: 'ice-005' },
  shiba: { 1: 'shadow-001', 2: 'shadow-002', 3: 'shadow-003', 4: 'shadow-004', 5: 'shadow-005' },
  fusion: { 1: 'fusion-f01', 2: 'fusion-f02', 3: 'fusion-f03', 4: 'fusion-f04' },
  hidden: { 1: 'hidden-h01', 2: 'hidden-h02', 3: 'hidden-h03', 4: 'hidden-h04' },
};

// key -> { tail, halo } layer files. Tail wag angle in degrees, from the
// manifest's per-sprite animation notes (fan layers use a smaller sway).
const ART_LAYERS = {
  'light-001': { tail: 'light-001-tail.png', wag: 12 },
  'light-002': { tail: 'light-002-tail.png', wag: 8, fast: true },
  'light-003': { tail: 'light-003-tail.png', wag: 15 },
  'light-004': { tail: 'light-004-tail.png', wag: 10 },
  'light-005': { tail: 'light-005-tail.png', wag: 10 },
  'ice-001': { tail: 'ice-001-tail.png', wag: 15 },
  'ice-002': { tail: 'ice-002-tail.png', wag: 15 },
  'ice-003': { tail: 'ice-003-tail.png', wag: 15 },
  'ice-004': { tail: 'ice-004-tail.png', wag: 15 },
  'ice-005': { tail: 'ice-005-tail.png', wag: 10 },
  'shadow-001': { tail: 'shadow-001-tail.png', wag: 12 },
  'shadow-002': { tail: 'shadow-002-tail.png', wag: 15 },
  'shadow-003': { tail: 'shadow-003-tail.png', wag: 8, fast: true },
  'shadow-004': { tail: 'shadow-004-tail.png', wag: 8 },
  'shadow-005': { tail: 'shadow-005-tail.png', wag: 6, fan: true },
  'fusion-f01': { tail: 'fusion-f01-tail.png', wag: 15 },
  'fusion-f02': { halo: 'fusion-f02-halo.png' },
  'fusion-f03': { tail: 'fusion-f03-tail.png', wag: 10, fan: true },
  'fusion-f04': { tail: 'fusion-f04-tail.png', wag: 15 },
  'hidden-h01': { tail: 'hidden-h01-tail.png', wag: 10 },
  'hidden-h02': { tail: 'hidden-h02-tail.png', wag: 12, glitch: true },
  'hidden-h03': { tail: 'hidden-h03-tail.png', wag: 10 },
  'hidden-h04': { tail: 'hidden-h04-tail.png', wag: 15, halo: 'hidden-h04-halo.png' },
};

function artKeyFor(breed, stage) {
  const line = ART_KEYFRAMES[breed];
  return line ? (line[stage] || null) : null;
}

/* ---------------- loading + chroma-key ---------------- */

const artImages = {}; // path -> { img, ok }
const artKeyed = {}; // layer path -> keyed canvas (green removed)

function artLoad(path) {
  if (artImages[path]) return artImages[path];
  const entry = { img: new Image(), ok: false };
  entry.img.onload = () => { entry.ok = true; };
  entry.img.onerror = () => { entry.ok = false; };
  entry.img.src = path;
  artImages[path] = entry;
  return entry;
}

// Preload every keyframe + layer at startup (relative paths only, so
// python3 -m http.server and GitHub Pages both keep working).
Object.keys(ART_KEYFRAMES).forEach((group) => {
  Object.keys(ART_KEYFRAMES[group]).forEach((stage) => {
    artLoad('assets/dogs/' + ART_KEYFRAMES[group][stage] + '.png');
  });
});
Object.keys(ART_LAYERS).forEach((key) => {
  const L = ART_LAYERS[key];
  if (L.tail) artLoad('assets/dogs/layers/' + L.tail);
  if (L.halo) artLoad('assets/dogs/layers/' + L.halo);
});

// Chroma-key exact #00FF00 -> transparent, then crop to the content
// bbox. Returns a canvas (or null when the source is not loaded).
// Result is cached, so the per-frame cost is just drawImage calls.
function artKeyedLayer(path) {
  if (artKeyed[path]) return artKeyed[path];
  const entry = artImages[path];
  if (!entry || !entry.ok) return null;
  const src = entry.img;
  const work = document.createElement('canvas');
  work.width = src.naturalWidth || 96;
  work.height = src.naturalHeight || 96;
  const wctx = work.getContext('2d');
  wctx.drawImage(src, 0, 0);
  const data = wctx.getImageData(0, 0, work.width, work.height);
  const px = data.data;
  let minX = work.width, minY = work.height, maxX = -1, maxY = -1;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] === 0 && px[i + 1] === 255 && px[i + 2] === 0) {
      px[i + 3] = 0;
    } else {
      const p = i / 4;
      const x = p % work.width, y = Math.floor(p / work.width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  wctx.putImageData(data, 0, 0);
  if (maxX < 0) return null; // fully green: nothing to draw
  const crop = document.createElement('canvas');
  crop.width = maxX - minX + 1;
  crop.height = maxY - minY + 1;
  crop.getContext('2d').drawImage(work, minX, minY, crop.width, crop.height, 0, 0, crop.width, crop.height);
  const out = { canvas: crop, w: crop.width, h: crop.height };
  artKeyed[path] = out;
  return out;
}

/* ---------------- keyframe background removal ---------------- */

// Keyframes ship on a pale-grey background that varies slightly per
// file (corners differ by a few levels), so exact-color keying would
// leave speckles. Instead, flood-fill outward from the borders,
// removing only pixels within a small tolerance of the corner color
// that are CONNECTED to the border. Interior fur is never touched:
// white fur sits ~30 levels away per channel, outside the tolerance,
// and enclosed pixels are unreachable by the fill anyway.
const artKeyedFrames = {}; // key -> canvas with background removed

function artKeyedFrame(key) {
  if (artKeyedFrames[key]) return artKeyedFrames[key];
  const entry = artImages['assets/dogs/' + key + '.png'];
  if (!entry || !entry.ok) return null;
  const src = entry.img;
  const work = document.createElement('canvas');
  work.width = src.naturalWidth || 96;
  work.height = src.naturalHeight || 96;
  const wctx = work.getContext('2d');
  wctx.drawImage(src, 0, 0);
  const data = wctx.getImageData(0, 0, work.width, work.height);
  const px = data.data, W = work.width, H = work.height;
  const br = px[0], bg = px[1], bb = px[2];
  const TOL = 12;
  const near = (i) => Math.abs(px[i] - br) <= TOL &&
    Math.abs(px[i + 1] - bg) <= TOL && Math.abs(px[i + 2] - bb) <= TOL;
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, x + (H - 1) * W); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + (W - 1)); }
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!near(i)) continue;
    px[i + 3] = 0;
    const x = p % W, y = Math.floor(p / W);
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }
  wctx.putImageData(data, 0, 0);
  artKeyedFrames[key] = work;
  return work;
}

/* ---------------- drawing ---------------- */

// Dog box: keyframe drawn at 150x150, top-left (135, 100) on the
// 480x300 canvas — feet land on the ground line, head clears the sky.
// Tail base anchor: rear-right side of the body (dogs face forward, so
// the tail peeks from behind at the side, never pasted over the face).
function drawArtDog(ctx, breed, stage, opts) {
  opts = opts || {};
  const key = artKeyFor(breed, stage);
  if (!key) return false;
  const kf = artImages['assets/dogs/' + key + '.png'];
  if (!kf || !kf.ok) return false; // caller falls back to placeholder
  ctx.imageSmoothingEnabled = false;

  const D = 150, dx = 135, dy = 100;
  const now = Date.now();
  const digging = now < (typeof digAnimUntil !== 'undefined' ? digAnimUntil : 0);
  const t = now / 1000;

  // Idle bob + dig tilt. While digging the body tilts and bobs faster.
  const bob = digging ? Math.sin(now / 60) * 4 : Math.sin(t * 2.2) * 2;
  const tilt = digging ? Math.sin(now / 120) * 0.07 : 0;
  const cx = dx + D / 2, cy = dy + D / 2 + bob;

  const L = ART_LAYERS[key] || {};

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  // Tail layer, behind the keyframe, wagging around its base
  // (bottom-center of the cropped tail content).
  const tailPath = L.tail ? 'assets/dogs/layers/' + L.tail : null;
  const tail = tailPath ? artKeyedLayer(tailPath) : null;
  if (tail) {
    const wagDeg = L.wag || 12;
    const wagSpeed = L.fast ? 9 : 5;
    const ang = Math.sin(t * wagSpeed) * wagDeg * Math.PI / 180;
    const tailW = D * 0.42;
    const tailH = tailW * tail.h / tail.w;
    const baseX = D * 0.30, baseY = D * 0.12; // rear side, mid-body
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(ang);
    ctx.drawImage(tail.canvas, -tailW / 2, -tailH, tailW, tailH);
    ctx.restore();
  }

  // Keyframe (background removed), with glitch slice offsets for
  // hidden-h02 (and any sprite drawn with opts.glitch, matching the
  // old placeholder's H02 effect).
  const frame = artKeyedFrame(key);
  if (!frame) return false;
  const glitchOn = !!opts.glitch || !!L.glitch;
  if (glitchOn && Math.random() < 0.5) {
    // Draw in horizontal slices with small random offsets.
    const slices = 6, sh = D / slices;
    for (let i = 0; i < slices; i++) {
      const off = Math.floor(Math.random() * 7) - 3;
      ctx.drawImage(frame, 0, i * (frame.height / slices), frame.width, frame.height / slices,
        -D / 2 + off, -D / 2 + i * sh, D, sh);
    }
  } else {
    ctx.drawImage(frame, -D / 2, -D / 2, D, D);
  }

  // NOTE: halo layers are deliberately NOT overlaid. Eyeballing showed
  // every halo layer doubles the halo already baked into its keyframe
  // (a second, larger ring around the dog). Halo motion is therefore
  // limited to the whole-sprite bob/sway; fusion-f02's halo motion
  // comes from its body sway + eye pulse instead.

  ctx.restore();

  // Sniff pulse: a soft highlight near the nose for ~1.5s after a
  // sniff (stronger on the light line, the team's nose).
  if (typeof lastSniffAt !== 'undefined' && now - lastSniffAt < 1500) {
    const a = 0.35 * (1 - (now - lastSniffAt) / 1500);
    ctx.fillStyle = 'rgba(255, 240, 150, ' + a.toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(dx + D * 0.55, dy + D * 0.38 + bob, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // fusion-f02 has no tail layer: body sway + halo + eye pulse cover
  // it (sway is the whole-body bob above; halo rotates above).
  return true;
}
