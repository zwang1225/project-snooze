// project-snooze prototype MVP 1.
// Single-page, vanilla JS, Canvas 2D. No frameworks, no build step.
// Spec source: idea-os ideas/project-snooze/ (SPEC.md + DECISIONS.md).
// Everything locked in D1-D14 is implemented as written; numbers marked
// placeholder / playtest-tuned in the spec are used as placeholders here.
'use strict';

/* ---------------- spec constants (placeholders where the spec says so) ---------------- */

const BREEDS = {
pomeranian: { name: '博美', line: '光线', stages: ['奶团子', '奶凶博美', '叼剑毛球']},
husky: { name: '哈士奇', line: '冰线', stages: ['小二哈', '拆家狂魔', '雪橇队长']},
shiba: { name: '柴犬', line: '影线', stages: ['倔头柴', '表情包柴', '忍者柴']},
};
// XP needed to go from stage i to i+1 (index 0 = 001->002). Placeholder rates
// tuned so the first evolution lands within ~60s of play.
const XP_NEED = [150, 600];
const XP_PER_DIG = 10;
const XP_PER_SNIFF = 5;

const SCENT_TYPES = {
strong: { label: '味浓土硬', hint: '大货，慢', bones: 6, cooldownMs: 1200},
light: { label: '味淡土松', hint: '快货，少', bones: 2, cooldownMs: 400},
strange: { label: '味怪', hint: '未知', bones: null, cooldownMs: 700},
};
// Breed affinity (spec D1.3 division of labor, single-protagonist MVP form).
// Per-second rates are kept roughly equal so no point is ever optimal:
// strong 6/1.2s = 5/s, light 2/0.4s = 5/s, strange avg 3.5/0.7s = 5/s.
function affinityBonus(breed, type) {
if (breed === 'husky' && type === 'strong') return 2;
if (breed === 'shiba' && type === 'strange') return 2;
if (breed === 'pomeranian' && type === 'strange') return 1;
return 0;
}

const LAYER_1_CLEAR_AT = 300; // bones dug in this dream to clear layer 1
const BURY_MIN = 10;
const BURY_INTEREST = 0.30; // +30% on maturity
const BURY_MATURE_MS = 60 * 1000; // placeholder: shortened for the prototype
const SPEND_COST = 20; // bones -> +1 dig power for this dream
const SPEND_POWER = 1;
const FIRST_WAKE_BONUS = 100; // settlement, paid once
const UPGRADE_BASE_COST = 100; // settlement for level 1->2; cost scales with level
const UPGRADE_MAX_LEVEL = 5;
const UPGRADE_LEVEL_NAMES = {
bowl: ['破碗', '钢碗', '陶瓷碗', '慢食碗', '自动喂食机'],
kennel: ['纸箱', '垫子', '木屋', '别墅', '庄园'],
toy: ['破布', '球', '飞盘', '益智玩具', '玩具箱'],
yard: ['没院子', '小院', '菜园', '花园', '大庄园'],
};
function upgradeCost(lineKey) { return UPGRADE_BASE_COST * S.upgrades[lineKey]; }
const AUTO_COST = 100; // bones, one-time unlock after the first wake (placeholder)
const DIG_RANGE = 40; // px: dog must be this close to a pit to dig it
const WALK_SPEED = 260; // px/s: player-directed and auto walking (placeholder; 1280-wide map takes ~5s to cross)
const DOG_X_MIN = 75, DOG_X_MAX = 1205; // dog box half-width 75 on the 1280-wide field
const DOG_Y_MIN = 160, DOG_Y_MAX = 790; // feet y across the whole field (box top 10..640, 10px margins)
const CODEX_NEW_BONUS = 50; // D10 placeholder
const SHORT_DREAM_S = 180; // dreams under 3 minutes settle at 20%
const GLITCH_TAPS = 999; // taps before the small chance starts
const GLITCH_CHANCE = 0.01; // per tap after 999 (placeholder probability)

const UPGRADE_LINES = [
{ key: 'bowl', label: '饭盆'},
{ key: 'kennel', label: '狗窝'},
{ key: 'toy', label: '玩具'},
{ key: 'yard', label: '院子'},
];

const CODEX = {
hero: { title: '主角图鉴', text: '你选定的狗。它不会被重置，梦会清空，家不会。'},
'riddle-h02': { title: '???', text: '谜语：它在你一直点它的时候出现。'},
h02: { title: 'ERROR.PUP（乱码狗）', text: '全身花屏错位。它自己不知道自己坏了，照样刨坑摇尾巴，只是尾巴一摇就错位到头顶。'},
'sea-dream': { title: '海梦事件', text: '连吃 3 次三文鱼，下一场梦开出隐藏海梦。'},
'shadow-teaser': { title: '夜访影狗的影子', text: '见过它来过，还没见过它：夜里草地上一串湿脚印，远远闪过一个影子。H03 本体收服留后续版本。'},
'dream-flower': { title: '梦花', text: '总在院子同一个角落转悠，那块地长出了一朵梦花。'},
'cardboard-god': { title: '纸箱之神', text: '拥有狗别墅（狗窝 4 级）后、连选 5 次纸箱睡，才能解锁。'},
snowfield: { title: '雪原场景', text: '第一次醒来后解锁。雪原倾向：冰线朋友与冻土隐藏出现率更高。'},
'meteor-night': { title: '流星夜', text: '随机夜晚，全场产出翻倍 10 分钟。'},
};

/* ---------------- save state (only ever touched via StorageAdapter) ---------------- */

function freshSave() {
return {
version: 1,
name: '', breed: '',
stage: 1, xp: 0,
taps: 0, glitchUnlocked: false,
phase: 'setup',
// dream-run state
bones: 0, totalBonesThisDream: 0, digPower: 0,
buried: [], // {amount, readyAt}
dreamStart: 0, dreamCount: 0, deepestLayer: 1,
layerBones: 0, layerCleared: false,
dreamCodexNew: [],
scene: 'meadow', meteorNight: false, seaDreamActive: false,
// meta state
settlement: 0,
upgrades: { bowl: 1, kennel: 1, toy: 1, yard: 1},
wakes: 0, firstWakeBonusPaid: false,
codex: { hero: true, 'riddle-h02': true},
streaks: { salmon: 0, cardboard: 0, park: 0, yardCorner: 0},
scenesUnlocked: ['meadow'],
autoUnlocked: false,
pinned: null,
shadowTeaserSeen: false,
};
}

let S = StorageAdapter.load() || freshSave();
if (!S.version) S = freshSave();

// Transient (not saved): current pits, dig cooldown, animation, movement.
let scentPoints = []; // world pits: {type, label, hint, bones, cooldownMs, x, y}
let lastDigAt = 0;
let autoOn = false; // dream-scoped toggle; the unlock (S.autoUnlocked) persists
let keysDown = new Set();
let dogTarget = null; // {x, y} touch-only tap-to-move destination, feet coords
// D23 body-first input: WASD steers, C toggles mouse-follow, the mouse
// no longer moves the dog on desktop. Tap-to-move survives only on
// coarse-pointer (touch) devices, where there is no keyboard: without
// it a phone could not play at all.
const IS_TOUCH = typeof window !== 'undefined' &&
typeof window.matchMedia === 'function' &&
window.matchMedia('(pointer: coarse)').matches;
let followMode = false; // C toggles: dog steers toward pointerPos
let pointerPos = null; // {x, y} latest canvas pointer position, feet coords
let dogWander = null; // {x, y} idle-roam destination
let digAnimUntil = 0;
let lastBuryLog = '';
// Readability: scent points stay hidden until the first sniff of a dream,
// and the evolution banner stays up until dismissed or the next action.
let scentsRevealed = false;

// Interaction pass (visual feedback only — no rules live here).
// Dog position is visible state on the 1280x800 canvas: the dog box is
// 150x150, dogX is the box CENTER x, dogY is the FEET y anywhere on
// the field (160-790). D26: the dog roams the whole field (WASD +
// C mouse-follow; touch tap-to-move only); scent points are world
// pits it walks up to and digs by standing there.
const DOG_BOX = 150;
let dogX = 640, dogY = 400, dogPauseUntil = 0, dogMicroX = null;
let dogSpeedPxS = 0; // D19: current movement speed (0 idle, 55 wander, 320 run)
let holes = []; // {x} — dig pits dug this dream, drawn on the ground
let particles = []; // {kind:'dirt'|'heart', x, y, vx, vy, born, life}
let flyingBones = []; // {x0, y0, x1, y1, born, dur, tier}
let petReactUntil = 0, petWagUntil = 0;
let lastDigRare = false; // set by digYield when the strange rare bonus hits
let lastFrameAt = 0;

function save() { StorageAdapter.save(S);}
function $(id) { return document.getElementById(id);}
function log(msg) {
const el = $('log');
el.textContent = msg + '\n' + el.textContent;
// "Latest news" line right under the HUD: the newest message is visible
// without scrolling to the bottom log, especially on phones.
const latest = $('latest-msg');
if (latest) latest.textContent = '最新消息：' + msg;
}

function showEvolutionBanner(prevName, newName) {
const banner = $('evolution-banner');
const text = $('evolution-banner-text');
const hint = $('next-hint');
if (!banner || !text) return;
text.textContent = '进化！' + prevName + ' → ' + newName;
banner.style.display = 'block';
if (hint) {
hint.textContent = '继续刨攒骨头，推不动就按醒来结算';
hint.style.display = 'block';
}
}

function hideEvolutionBanner() {
const banner = $('evolution-banner');
const hint = $('next-hint');
if (banner) banner.style.display = 'none';
if (hint) hint.style.display = 'none';
}
function unlockCodex(id, dreamScoped) {
if (!S.codex[id]) {
S.codex[id] = true;
if (dreamScoped &&!S.dreamCodexNew.includes(id)) S.dreamCodexNew.push(id);
log('图鉴新条目：' + CODEX[id].title);
}
}
function stageName() { return BREEDS[S.breed].stages[S.stage - 1];}
function xpNeed() { return S.stage <= 2? XP_NEED[S.stage - 1]: Infinity;}

function gainXp(n) {
if (S.stage >= 3) return; // MVP slice caps at stage 003
S.xp += n;
while (S.stage < 3 && S.xp >= xpNeed()) {
const prevName = stageName();
S.xp -= xpNeed();
S.stage += 1;
log('进化！' + BREEDS[S.breed].name + '变成了' + stageName() + '。');
showEvolutionBanner(prevName, stageName());
}
}

/* ---------------- canvas scene ---------------- */

const canvas = $('scene');
const ctx = canvas.getContext('2d');

function scenePalette() {
if (S.scene === 'snowfield') return { sky: '#dfe9f5', ground: '#eef4fb', dirt: '#c9d6e8', pit: '#9fb4cc'};
if (S.seaDreamActive) return { sky: '#bfe3ee', ground: '#d8ecdf', dirt: '#8a6a48', pit: '#5a4630'};
return { sky: '#cfe8b8', ground: '#a8d98a', dirt: '#8a6a48', pit: '#5a4630'};
}

/* ---------------- interaction visuals (feedback only, no rules) ---------------- */

// Bone tiers (spec D1.1 quality ladder: plain -> meaty -> gold -> fossil).
// VISUAL-ONLY mapping from one dig's yield — the economy is untouched:
// the rare strange bonus shows as a fossil find, 6+ bones as gold,
// 3-5 as meaty, otherwise plain. Deeper layers (where fossils would
// naturally live) are not in the MVP, so the rare bonus is the only
// way a fossil appears for now.
function boneTierFor(got, rare) {
if (rare) return 'fossil';
if (got >= 6) return 'gold';
if (got >= 3) return 'meaty';
return 'plain';
}

const BONE_COLORS = {
plain: '#f5e9c8', meaty: '#f5e9c8', gold: '#f2c233', fossil: '#9a8a76',
};

// Programmatic pixel bone sprite (8x6 grid, no image files needed).
// Drawn centered at (x, y); u is the pixel unit size.
function drawBonePixel(c, x, y, u, tier) {
const grid = [
'XX....XX',
'XXX..XXX',
'.XXXXXX.',
'.XXXXXX.',
'XXX..XXX',
'XX....XX',
];
const col = BONE_COLORS[tier] || BONE_COLORS.plain;
const w = 8 * u, h = 6 * u;
const ox = Math.round(x - w / 2), oy = Math.round(y - h / 2);
c.fillStyle = col;
grid.forEach((row, ry) => {
for (let rx = 0; rx < row.length; rx++) {
if (row[rx] === 'X') c.fillRect(ox + rx * u, oy + ry * u, u, u);
}
});
// Tier dressing: meat bits, gold sparkle, fossil crack.
if (tier === 'meaty') {
c.fillStyle = '#d23b2e';
c.fillRect(ox + 2 * u, oy + 1 * u, u, u);
c.fillRect(ox + 5 * u, oy + 4 * u, u, u);
} else if (tier === 'gold') {
c.fillStyle = '#fff3b0';
c.fillRect(ox + 3 * u, oy + 2 * u, u, u);
} else if (tier === 'fossil') {
c.fillStyle = '#5a4630';
c.fillRect(ox + 1 * u, oy + 2 * u, u, u);
c.fillRect(ox + 2 * u, oy + 3 * u, u, u);
c.fillRect(ox + 4 * u, oy + 2 * u, u, u);
}
}

// Tiny pixel heart for the pet reaction (5x5 grid).
function drawHeartPixel(c, x, y, u) {
const grid = ['XX.XX', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
c.fillStyle = '#f27aa0';
grid.forEach((row, ry) => {
for (let rx = 0; rx < row.length; rx++) {
if (row[rx] === 'X') c.fillRect(Math.round(x - 2.5 * u) + rx * u, Math.round(y - 2.5 * u) + ry * u, u, u);
}
});
}

function dogBox() {
return { left: dogX - DOG_BOX / 2, top: dogY - DOG_BOX, size: DOG_BOX };
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
// Walk toward (tx, ty) at WALK_SPEED; returns true on arrival.
function moveToward(tx, ty, dt) {
const dx = tx - dogX, dy = ty - dogY;
const dist = Math.hypot(dx, dy);
const step = WALK_SPEED * dt;
if (dist <= step) { dogX = tx; dogY = ty; dogSpeedPxS = 0; return true; }
dogX = clamp(dogX + dx / dist * step, DOG_X_MIN, DOG_X_MAX);
dogY = clamp(dogY + dy / dist * step, DOG_Y_MIN, DOG_Y_MAX);
dogSpeedPxS = WALK_SPEED;
return false;
}
// Nearest revealed pit matching filter (or any pit); null when unrevealed.
function nearestPit(filter) {
if (!scentsRevealed) return null;
let best = null, bestD = Infinity;
scentPoints.forEach((p) => {
if (filter && !filter(p)) return;
const d = Math.hypot(p.x - dogX, p.y - dogY);
if (d < bestD) { bestD = d; best = p; }
});
return best;
}
function nearestPitInRange() {
const p = nearestPit(null);
return p && Math.hypot(p.x - dogX, p.y - dogY) <= DIG_RANGE ? p : null;
}
// Idle roam: walk to a random ground spot, pause, walk again.
function wander(now, dt) {
if (now < dogPauseUntil) { dogSpeedPxS = 0; return; }
if (!dogWander) {
dogWander = { x: 150 + Math.random() * 980,
y: DOG_Y_MIN + Math.random() * (DOG_Y_MAX - DOG_Y_MIN) };
dogSpeedPxS = 0;
return;
}
if (moveToward(dogWander.x, dogWander.y, dt)) {
dogWander = null;
dogPauseUntil = now + 1000 + Math.random() * 2000;
}
}

// Dog motion (D23): manual keys take over, then mouse-follow, then auto
// mode, then the touch tap-to-move destination, then idle roaming.
// Called every frame with an explicit dt so it is deterministic under test.
function updateDogMotion(now, dtMs) {
if (S.phase !== 'dream') { dogSpeedPxS = 0; return; }
const dt = dtMs / 1000;
// Manual keys (WASD/arrows) take over and switch auto and follow off.
let kx = 0, ky = 0;
if (keysDown.has('left')) kx -= 1;
if (keysDown.has('right')) kx += 1;
if (keysDown.has('up')) ky -= 1;
if (keysDown.has('down')) ky += 1;
if (kx || ky) {
if (autoOn) setAuto(false, true);
followMode = false;
dogTarget = null;
dogWander = null;
const len = Math.hypot(kx, ky);
dogX = clamp(dogX + kx / len * WALK_SPEED * dt, DOG_X_MIN, DOG_X_MAX);
dogY = clamp(dogY + ky / len * WALK_SPEED * dt, DOG_Y_MIN, DOG_Y_MAX);
dogSpeedPxS = WALK_SPEED;
return;
}
// Mouse-follow mode (C): steer toward the pointer; no pointer yet
// means stand still (do not wander off while the player is aiming).
if (followMode) {
if (!pointerPos) { dogSpeedPxS = 0; return; }
moveToward(pointerPos.x, pointerPos.y, dt);
return;
}
// Auto mode: walk to the nearest ordinary pit; digging itself is the
// shared walk-to-dig rule (tryWalkDig), not an auto-only call, so the
// manual and auto paths can never drift apart. Strange pits are never
// auto-targeted (D1 red line: special points stay player-picked).
if (autoOn) {
const pit = nearestPit((q) => q.type !== 'strange');
if (!pit) { wander(now, dt); return; }
if (moveToward(pit.x, pit.y, dt)) {
// Arrived: sniff around the pit while the walk-to-dig rule digs it.
if (dogMicroX === null) dogMicroX = pit.x;
const mStep = 20 * dt;
if (Math.abs(dogMicroX - dogX) <= mStep) {
dogX = dogMicroX;
dogMicroX = pit.x - 14 + Math.random() * 28;
dogSpeedPxS = 0;
} else {
dogX += Math.sign(dogMicroX - dogX) * mStep;
dogSpeedPxS = 20;
}
return;
}
dogMicroX = null;
return;
}
// Touch tap-to-move destination (desktop clicks never set this).
if (dogTarget) {
if (moveToward(dogTarget.x, dogTarget.y, dt)) dogTarget = null;
return;
}
wander(now, dt);
}

// Walk-to-dig rule (D23): standing by a revealed pit with its cooldown
// ready digs it — no button press. Walking away stops digging because
// the rule only fires while a pit is in range. Called once per frame
// after updateDogMotion, so every way of arriving (keys, follow, auto,
// touch) digs through the same path.
function tryWalkDig() {
if (S.phase !== 'dream' || !scentsRevealed) return;
const pit = nearestPitInRange();
if (!pit) return;
// D1 red line, preserved under the new trigger: auto mode walks past
// strange pits on its way to ordinary ones, but must never dig them —
// a strange pit only digs when the player walked there themself.
if (autoOn && pit.type === 'strange') return;
if (Date.now() - lastDigAt < pit.cooldownMs) return;
doDig(pit);
}

function drawScene() {
const pal = scenePalette();
const now = Date.now();
// D26 top-down field: the whole canvas is ground color (pal.sky is
// kept in the palette for the future background art, not used here).
ctx.fillStyle = pal.ground;
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Pit markers on the field (visible targets the dog walks up to).
// Colors: strong amber, light green, strange purple; the pit in dig
// range gets a ring so the player knows standing here digs it.
if (scentsRevealed) {
const colors = { strong: '#c96a2b', light: '#7fb069', strange: '#9b5de5' };
const active = nearestPitInRange();
scentPoints.forEach((p) => {
const col = colors[p.type] || '#888888';
ctx.fillStyle = col;
for (let i = 0; i < 3; i++) {
const wx = p.x - 8 + i * 8;
const wy = p.y - 18 + Math.sin(now / 300 + i) * 2;
ctx.fillRect(wx, wy, 3, 10);
}
if (active === p) {
ctx.strokeStyle = '#ffd23b';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.ellipse(p.x, p.y, 30, 10, 0, 0, Math.PI * 2);
ctx.stroke();
}
});
}

// Dig pits dug this dream (persist until the next dream starts).
holes.forEach((h) => {
ctx.fillStyle = pal.pit;
ctx.beginPath();
ctx.ellipse(h.x, h.y, 26, 8, 0, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = pal.dirt;
ctx.beginPath();
ctx.ellipse(h.x, h.y, 18, 5, 0, 0, Math.PI * 2);
ctx.fill();
});

// Bone pile, bottom-right: grows with this dream's bone count
// (visual only, capped at 8 sprites; +1 per 5 bones so it visibly
// grows inside a single dream — the old /40 step stayed at 1 bone).
if (S.bones > 0) {
const n = Math.min(8, 1 + Math.floor(S.bones / 5));
for (let i = 0; i < n; i++) {
drawBonePixel(ctx, 1170 + (i % 3) * 16, 735 + Math.floor(i / 3) * 10, 2, 'plain');
}
}

// Dog: real art when loaded (js/art.js), else the old placeholder.
// Position comes from dogX (roaming / running to the scent point);
// pet reactions ride on top via opts (bounce + faster wag).
const box = dogBox();
if (typeof drawArtDog !== 'function' || !drawArtDog(ctx, S.breed, S.stage, {
glitch: S.glitchUnlocked,
glow: S.stage >= 3,
dx: box.left, dy: box.top,
petBounce: now < petReactUntil,
wagBoost: now < petWagUntil,
speed: dogSpeedPxS,
})) {
const bob = now < digAnimUntil? Math.sin(now / 60) * 4: 0;
drawDogSprite(ctx, S.breed, S.stage, 6, box.left + 39, box.top + 96 + bob, {
glitch: S.glitchUnlocked,
glow: S.stage >= 3,
});
}

// Dirt + heart particles (age-based, so they animate between ticks).
particles = particles.filter((pt) => now - pt.born < pt.life);
particles.forEach((pt) => {
const age = (now - pt.born) / 1000;
if (pt.kind === 'dirt') {
const px = pt.x + pt.vx * age;
const py = pt.y + pt.vy * age + 0.5 * 300 * age * age;
ctx.fillStyle = 'rgba(138, 106, 72, ' + Math.max(0, 1 - age / (pt.life / 1000)).toFixed(2) + ')';
ctx.fillRect(px, py, 6, 6);
} else {
const py = pt.y + pt.vy * age;
ctx.globalAlpha = Math.max(0, 1 - age / (pt.life / 1000));
drawHeartPixel(ctx, pt.x, py, 3);
ctx.globalAlpha = 1;
}
});

// Flying bones: arc from the dig spot toward the HUD counter corner.
flyingBones = flyingBones.filter((b) => now - b.born < b.dur);
flyingBones.forEach((b) => {
const p = (now - b.born) / b.dur;
const fx = b.x0 + (b.x1 - b.x0) * p;
const fy = b.y0 + (b.y1 - b.y0) * p - Math.sin(Math.PI * p) * 60;
drawBonePixel(ctx, fx, fy, 4, b.tier);
});

// Shadow-teaser pawprints (D9 recipe 4, teaser form only).
if (S.shadowTeaserSeen && S.scene === 'meadow') {
ctx.fillStyle = 'rgba(90, 70, 48, 0.55)';
for (let i = 0; i < 4; i++) {
ctx.beginPath();
ctx.ellipse(120 + i * 26, 540 + (i % 2) * 8, 7, 4, 0, 0, Math.PI * 2);
ctx.fill();
}
}
// Meteor-night sparkle.
if (S.meteorNight) {
ctx.fillStyle = '#ffe97a';
for (let i = 0; i < 8; i++) {
const x = 20 + ((i * 53) % 1200);
const y = 12 + ((i * 29) % 60);
ctx.fillRect(x, y, 3, 3);
}
}
}

// Clicking the dog counts as a tap (H02 counter). The Pet button does the same.
// Clicking anywhere else does NOT move the dog on desktop (D23: the mouse
// points at panels and the dog, it does not steer); on touch devices a
// tap elsewhere is a move order, the only steering a phone has. The
// click box follows the roaming dog.
function canvasCoords(e) {
const r = canvas.getBoundingClientRect();
return {
x: (e.clientX - r.left) * (canvas.width / r.width),
y: (e.clientY - r.top) * (canvas.height / r.height),
};
}
canvas.addEventListener('click', (e) => {
if (S.phase!== 'dream') return;
const { x, y } = canvasCoords(e);
const box = dogBox();
if (x >= box.left && x <= box.left + box.size && y >= box.top && y <= box.top + box.size) { petDog(); return; }
if (!IS_TOUCH) return;
if (autoOn) setAuto(false, true);
followMode = false;
dogTarget = { x: clamp(x, DOG_X_MIN, DOG_X_MAX), y: clamp(y, DOG_Y_MIN, DOG_Y_MAX) };
dogWander = null;
});
// Pointer tracking for mouse-follow mode (mousemove on desktop,
// touchmove so a finger drag can also steer in follow mode).
canvas.addEventListener('mousemove', (e) => {
if (S.phase !== 'dream') return;
const { x, y } = canvasCoords(e);
pointerPos = { x: clamp(x, DOG_X_MIN, DOG_X_MAX), y: clamp(y, DOG_Y_MIN, DOG_Y_MAX) };
});
canvas.addEventListener('touchmove', (e) => {
if (S.phase !== 'dream') return;
const t = e.touches && e.touches[0];
if (!t) return;
const { x, y } = canvasCoords(t);
pointerPos = { x: clamp(x, DOG_X_MIN, DOG_X_MAX), y: clamp(y, DOG_Y_MIN, DOG_Y_MAX) };
}, { passive: true });

// WASD / arrows steer the dog directly; C toggles mouse-follow mode.
// Ignored outside dreams so typing in the setup name field is never hijacked.
const KEY_DIRS = { w: 'up', a: 'left', s: 'down', d: 'right',
arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };
function toggleFollow() {
followMode = !followMode;
if (followMode) {
if (autoOn) setAuto(false, true);
dogTarget = null;
dogWander = null;
}
log(followMode ? '跟随鼠标：开（狗朝鼠标位置走；再按 C 关）' : '跟随鼠标：关。');
renderHUD();
}
document.addEventListener('keydown', (e) => {
if (S.phase !== 'dream') return;
const k = e.key.toLowerCase();
if (k === 'c') { toggleFollow(); return; }
const dir = KEY_DIRS[k];
if (!dir) return;
e.preventDefault();
keysDown.add(dir);
});
document.addEventListener('keyup', (e) => {
const dir = KEY_DIRS[e.key.toLowerCase()];
if (dir) keysDown.delete(dir);
});

function petDog() {
const now = Date.now();
petReactUntil = now + 2000; // happy bounce, held so the squash reads across views
petWagUntil = now + 2000; // faster tail wag for a moment
for (let i = 0; i < 3; i++) {
particles.push({ kind: 'heart', x: dogX - 20 + i * 20, y: dogY - 120,
vx: 0, vy: -35, born: now, life: 900 });
}
S.taps += 1;
if (!S.glitchUnlocked && S.taps > GLITCH_TAPS && Math.random() < GLITCH_CHANCE) {
S.glitchUnlocked = true;
unlockCodex('h02', true);
log('！！！你点出了乱码狗 ERROR.PUP：它全身花屏错位，还在摇尾巴。');
}
save();
renderHUD();
}

/* ---------------- dream loop ---------------- */

function rollScentPoints() {
const types = ['strong', 'light', 'strange'];
// Shuffle so the three types never sit in a fixed order.
for (let i = types.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[types[i], types[j]] = [types[j], types[i]];
}
// Each pit gets a field position (spread across the whole field)
// so the dog has somewhere visible to walk to.
const SCENT_SPOTS = [220, 640, 1060];
scentPoints = types.map((t, i) => ({ type: t,...SCENT_TYPES[t],
x: SCENT_SPOTS[i] + Math.floor(Math.random() * 20) - 10,
y: 120 + Math.floor(Math.random() * 561) }));
}

let lastSniffAt = 0; // drives the sniff pulse in js/art.js (not a rule)
function doSniff() {
lastSniffAt = Date.now();
// The banner gives way to the next action (it was shown by a previous one).
hideEvolutionBanner();
scentsRevealed = true;
rollScentPoints();
gainXp(XP_PER_SNIFF);
log('闻到了 ' + scentPoints.length + ' 个坑：走过去，走进坑就开挖。');
save();
renderHUD();
}

function digYield(point) {
lastDigRare = false;
let bones = point.bones;
if (point.type === 'strange') {
bones = 1 + Math.floor(Math.random() * 6);
if (Math.random() < 0.12) { bones += 5; lastDigRare = true; log('挖出稀有骨！+5');}
}
bones += affinityBonus(S.breed, point.type);
bones += S.digPower;
if (S.meteorNight && (Date.now() - S.dreamStart) < 10 * 60 * 1000) bones *= 2;
return bones;
}

function doDig(pitArg) {
// Digs the given pit; only ever called by the walk-to-dig rule, which
// has already checked range and cooldown. Digging at a pit you are not
// standing next to is not possible.
hideEvolutionBanner();
const pit = pitArg || nearestPitInRange();
if (!pit) { log('走近一个坑再刨（先闻一闻找出坑）。'); return;}
const now = Date.now();
if (now - lastDigAt < pit.cooldownMs) return;
lastDigAt = now;
digAnimUntil = now + 1200; // pose window only; dig cooldown stays on lastDigAt
const got = digYield(pit);
// Visible dig feedback (numbers unchanged): a pit at the dog's spot,
// flying dirt, and a bone sprite that pops out and flies to the counter.
if (holes.length >= 24) holes.shift();
holes.push({ x: dogX, y: dogY });
for (let i = 0; i < 22; i++) {
particles.push({ kind: 'dirt', x: dogX, y: dogY - 5,
vx: -120 + Math.random() * 240, vy: -190 + Math.random() * 110,
born: now, life: 1100 });
}
flyingBones.push({ x0: dogX, y0: dogY - 15, x1: 1230, y1: 18,
born: now, dur: 1200, tier: boneTierFor(got, lastDigRare) });
S.bones += got;
S.totalBonesThisDream += got;
S.layerBones += got;
gainXp(XP_PER_DIG);
if (!S.layerCleared && S.layerBones >= LAYER_1_CLEAR_AT) {
S.layerCleared = true;
log('第一层挖空了！第二层在原型里显示为锁定（后续版本开放）。');
}
save();
renderHUD();
}

// Auto mode (D21): one-time unlock after the first wake, then a toggle.
// The toggle resets every dream; the unlock persists in the save.
function setAuto(on, manual) {
if (on && !S.autoUnlocked) return;
autoOn = on;
if (on) followMode = false; // one driver at a time: auto or follow, never both
if (!on) dogMicroX = null;
if (manual) log('手动接管，自动已关。');
renderHUD();
}
function buyAuto() {
if (S.autoUnlocked) { setAuto(!autoOn, false); return; }
if (S.wakes < 1) { log('自动：第一次醒来后解锁。'); return; }
if (S.bones < AUTO_COST) { log('骨头不够：自动需要 ' + AUTO_COST + ' 根（一次买断）。'); return; }
S.bones -= AUTO_COST;
S.autoUnlocked = true;
autoOn = true;
log('自动已买断：狗会自己走、自己找普通坑刨；特殊味点仍要你亲选。点“自动”可随时关。');
save();
renderHUD();
renderHUD();
}

function doSpend() {
if (S.bones < SPEND_COST) { log('骨头不够：花骨头需要 ' + SPEND_COST + ' 根。'); return;}
S.bones -= SPEND_COST;
S.digPower += SPEND_POWER;
log('花掉 ' + SPEND_COST + ' 根骨头，本梦刨力 +' + SPEND_POWER + '（马上变强）。');
save();
renderHUD();
}

function doBury() {
if (S.bones < BURY_MIN) { log('埋骨头至少需要 ' + BURY_MIN + ' 根。'); return;}
S.bones -= BURY_MIN;
S.buried.push({ amount: BURY_MIN, readyAt: Date.now() + BURY_MATURE_MS});
log('埋下 ' + BURY_MIN + ' 根骨头，60 秒后挖出变多（原型缩短时长，占位）。');
save();
renderHUD();
}

function checkBuried() {
const now = Date.now();
const ready = S.buried.filter((b) => b.readyAt <= now);
if (ready.length) {
S.buried = S.buried.filter((b) => b.readyAt > now);
let back = 0;
ready.forEach((b) => { back += Math.round(b.amount * (1 + BURY_INTEREST));});
S.bones += back;
log('挖出埋下的骨头：' + back + ' 根（含利息）。');
save();
renderHUD();
}
}

function dreamSeconds() {
return S.dreamStart? Math.floor((Date.now() - S.dreamStart) / 1000): 0;
}

/* ---------------- wake / settlement (D10) ---------------- */

function settlementBreakdown() {
const total = S.totalBonesThisDream;
const base = Math.round(total * (1 + 0.1 * S.deepestLayer) + S.dreamCodexNew.length * CODEX_NEW_BONUS);
const secs = dreamSeconds();
const short = secs < SHORT_DREAM_S;
const settled = short? Math.round(base * 0.2): base;
const bonus =!S.firstWakeBonusPaid? FIRST_WAKE_BONUS: 0;
return { total, base, secs, short, settled, bonus, grand: settled + bonus};
}

function doWake() {
// Unmatured buried bones return their principal (no loss) at wake.
let principal = 0;
S.buried.forEach((b) => { principal += b.amount;});
S.buried = [];
S.bones += principal;
const r = settlementBreakdown();
S.settlement += r.grand;
if (!S.firstWakeBonusPaid) S.firstWakeBonusPaid = true;
S.wakes += 1;
if (S.wakes >= 1 &&!S.scenesUnlocked.includes('snowfield')) {
S.scenesUnlocked.push('snowfield');
unlockCodex('snowfield', false);
log('雪原场景解锁：下场梦可选。');
}
S.phase = 'wake';
hideEvolutionBanner();
save();
renderAll();
}

function doUpgrade(lineKey) {
const line = UPGRADE_LINES.find((l) => l.key === lineKey);
const lv = S.upgrades[lineKey];
if (lv >= UPGRADE_MAX_LEVEL) return;
const cost = upgradeCost(lineKey);
if (S.settlement < cost) { log('结算资源不够：升级需要 ' + cost + '。'); return;}
S.settlement -= cost;
S.upgrades[lineKey] = lv + 1;
const names = UPGRADE_LEVEL_NAMES[lineKey];
wakeNote(line.label + '升级：' + names[lv - 1] + ' → ' + names[lv] + '（家当升级，不占醒来名额）。');
save();
renderWake();
}

// Wake picks: eat 1 / play 1 / sleep 1 (D9). Each pick is one button group.
let wakePick = { eat: null, play: null, sleep: null};

function applyWakePicks() {
const { eat, play, sleep} = wakePick;
if (!eat ||!play ||!sleep) { log('醒来三格都要选：吃 1 格、玩 1 格、睡 1 格。'); return;}

// Eat: salmon streak -> sea dream next dream.
if (eat === 'salmon') {
S.streaks.salmon += 1;
if (S.streaks.salmon >= 3) {
S.streaks.salmon = 0;
S.seaDreamNext = true;
unlockCodex('sea-dream', false);
log('连吃 3 次三文鱼：下一场梦开出隐藏海梦！');
}
} else { S.streaks.salmon = 0;}

// Play: park -> shadow teaser (teaser form only, D9 fix); yard corner -> dream flower.
if (play === 'park') {
S.shadowTeaserSeen = true;
unlockCodex('shadow-teaser', false);
log('白天去公园疯跑：夜里草地上多了一串湿脚印——它来过，你还没见过它。');
}
if (play === 'yard-corner') {
S.streaks.yardCorner += 1;
if (S.streaks.yardCorner >= 3) {
S.streaks.yardCorner = 0;
unlockCodex('dream-flower', false);
log('总在院子同一个角落转悠：那块地长出了一朵梦花！');
}
} else { S.streaks.yardCorner = 0;}

// Sleep: cardboard streak; the Cardboard God payoff needs a villa (kennel
// level 4), which the MVP does not reach, so this only tracks progress.
if (sleep === 'cardboard') {
S.streaks.cardboard += 1;
if (S.upgrades.kennel >= 4 && S.streaks.cardboard >= 5) {
S.streaks.cardboard = 0;
unlockCodex('cardboard-god', false);
log('有狗别墅不住、连选 5 次纸箱：纸箱之神出现了！');
} else {
log('纸箱之神进度：连选纸箱 ' + S.streaks.cardboard + ' 次（需先拥有狗别墅，狗窝 4 级）。');
}
} else { S.streaks.cardboard = 0;}

startDream();
}

function startDream() {
S.phase = 'dream';
S.dreamCount += 1;
S.dreamStart = Date.now();
S.bones = 0;
S.totalBonesThisDream = 0;
S.digPower = 0;
S.layerBones = 0;
S.layerCleared = false;
S.dreamCodexNew = [];
S.seaDreamActive = S.seaDreamNext;
S.seaDreamNext = false;
wakePick = { eat: null, play: null, sleep: null };
S.meteorNight = Math.random() < 0.15;
if (S.meteorNight) unlockCodex('meteor-night', true);
scentsRevealed = false;
// Fresh dream, fresh ground: pits, particles and flying bones reset,
// and the dog starts back at the center of the scene.
holes = []; particles = []; flyingBones = [];
dogX = 640; dogY = 400; dogTarget = null; dogWander = null;
followMode = false; pointerPos = null;
dogPauseUntil = 0; dogMicroX = null; autoOn = false;
petReactUntil = 0; petWagUntil = 0;
hideEvolutionBanner();
rollScentPoints();
// Default scene: meadow unless the player picked snowfield on the dream screen.
save();
renderAll();
if (S.meteorNight) log('流星夜！本梦前 10 分钟全场产出翻倍。');
if (S.seaDreamActive) log('海梦事件：这场梦带着海的味道。');
}

/* ---------------- rendering ---------------- */

function fmtTime(s) {
return Math.floor(s / 60) + '分' + String(s % 60).padStart(2, '0') + '秒';
}

// Wake-phase confirmation: picking eat/play/sleep or buying an upgrade
// used to only grey out the button, which felt like clicking through a
// menu. Every pick now also writes one visible line in the wake panel
// (plus the log) stating what was chosen and what it does. Text only —
// no new art for the house, bowl, or pad.
function wakeNote(msg) {
const el = $('wake-pick-note');
if (el) el.textContent = '已选：' + msg;
log(msg);
}

const WAKE_PICK_NOTES = {
eat: {
kibble: '狗粮：饱餐一顿（无跨局效果；三文鱼连吃进度清零）。',
salmon: '三文鱼：三文鱼连吃进度 +1，连吃 3 次 → 下一场梦开出隐藏海梦。',
feast: '骨头大餐：大吃一顿（无跨局效果；三文鱼连吃进度清零）。',
},
play: {
park: '公园疯跑：夜里草地上会多一串湿脚印——它来过，你还没见过它（影子预告）。',
'night-road': '夜路散步：出去走了一圈（无跨局效果）。',
shelter: '收容所看看：去看了一圈（无跨局效果）。',
'yard-corner': '院子角落转转：院子角落进度 +1，转满 3 次 → 那块地长出梦花。',
},
sleep: {
cardboard: '纸箱：纸箱连选进度 +1（纸箱之神需先拥有狗别墅，狗窝 4 级）。',
mat: '垫子：在垫子上睡（无跨局效果）。',
},
};

// Single next-objective line (D20, carried into D22): computed from
// existing progress only, no new goal system. A pinned line sticks
// until unpinned (it snapshots the text; it does not auto-update).
function autoObjective() {
if (S.phase === 'wake') {
const n = (wakePick.eat ? 1 : 0) + (wakePick.play ? 1 : 0) + (wakePick.sleep ? 1 : 0);
return n >= 3 ? '三格已选满，睡过去开下一场梦' : '醒来三格还差 ' + (3 - n) + ' 格';
}
if (S.stage < 3) return '攒经历进化（' + S.xp + '/' + xpNeed() + '）';
if (!S.layerCleared) return '挖空第一层（' + Math.min(S.layerBones, LAYER_1_CLEAR_AT) + '/' + LAYER_1_CLEAR_AT + '）';
if (!S.autoUnlocked && S.wakes >= 1) return '攒 ' + AUTO_COST + ' 根骨头买断自动';
return '推不动就按“醒来”结算';
}

function renderHUD() {
const dogName = S.name || (S.breed && BREEDS[S.breed] ? BREEDS[S.breed].name : '');
// Pits stay hidden until the first sniff of a dream; sniffing
// reveals them (and re-rolls on later sniffs). Digging is walk-to-dig
// (D23): standing by a pit digs it, no button.
const hudEl = $('hud');
if (hudEl) hudEl.textContent = dogName + ' ' +
String(S.stage).padStart(3, '0') + ' ' + stageName() + ' ' +
' 骨头 ' + S.bones +
' | 刨力 +' + S.digPower +
' | 经历 ' + S.xp + '/' + (S.stage < 3? xpNeed(): '满') +
' | 第一层 ' + Math.min(S.layerBones, LAYER_1_CLEAR_AT) + '/' + LAYER_1_CLEAR_AT +
(S.layerCleared? '（已挖空）': '') +
' | 梦时长 ' + fmtTime(dreamSeconds()) +
' | 摸了 ' + S.taps + ' 次' +
(S.glitchUnlocked? ' | ERROR.PUP 已解锁': '');
// XP progress bar toward the next evolution (100% at the 003 cap).
const bar = $('xp-bar');
if (bar) {
bar.style.width = S.stage >= 3
? '100%'
: Math.min(100, Math.round(S.xp / xpNeed() * 1000) / 10) + '%';
}
const dogStatus = $('dog-status');
if (dogStatus) {
const pit = nearestPitInRange();
if (autoOn) dogStatus.textContent = '状态：自动开，狗自己走、自己找普通坑刨。';
else if (pit) {
const remain = Math.max(0, pit.cooldownMs - (Date.now() - lastDigAt));
dogStatus.textContent = remain > 0
? '状态：狗在坑边刨坑（冷却 ' + (remain / 1000).toFixed(1) + ' 秒）'
: '状态：狗在坑边刨坑。';
}
else if (followMode) dogStatus.textContent = '状态：跟随鼠标走。';
else if (dogTarget) dogStatus.textContent = '状态：狗正在走过去。';
else dogStatus.textContent = '状态：狗在闲逛。';
}
updateSceneArrows();
const objEl = $('next-objective');
if (objEl) objEl.textContent = S.pinned ? '已钉目标：' + S.pinned : '下一步：' + autoObjective();
const pinBtn = $('btn-pin');
if (pinBtn) pinBtn.textContent = S.pinned ? '取消钉' : '钉住目标';
const autoBtn = $('btn-auto');
if (autoBtn) {
if (!S.autoUnlocked) {
autoBtn.textContent = S.wakes >= 1
? '自动：' + AUTO_COST + ' 骨头一次买断（狗自己走自己找）'
: '自动：第一次醒来后解锁';
autoBtn.disabled = S.wakes < 1 || S.bones < AUTO_COST;
} else {
autoBtn.textContent = autoOn ? '自动：开（点一下关）' : '自动：关（点一下开）';
autoBtn.disabled = false;
}
}
const buriedPending = S.buried.reduce((a, b) => a + b.amount, 0);
if (buriedPending) {
const soonest = Math.min(...S.buried.map((b) => b.readyAt));
const sec = Math.max(0, Math.ceil((soonest - Date.now()) / 1000));
$('bury-status').textContent = sec > 0
? '埋着 ' + buriedPending + ' 根骨头（' + sec + ' 秒后挖出变多）'
: '埋着 ' + buriedPending + ' 根骨头（快挖出来了）';
} else {
$('bury-status').textContent = '没埋骨头';
}
}

function renderWake() {
const r = settlementBreakdown();
$('wake-breakdown').textContent =
'本梦总产出 ' + r.total + ' 根骨头 ×（1 + 0.1 × 最深层 ' + S.deepestLayer + '）' +
' + 新图鉴 ' + S.dreamCodexNew.length + ' × ' + CODEX_NEW_BONUS +
(r.short? ' → 短梦（< 3 分钟）只结算 20%': ' → 全额结算') +
(r.bonus? ' + 首醒教学奖励 ' + FIRST_WAKE_BONUS: '') +
' = 本次结算 ' + r.grand + '（当前持有 ' + S.settlement + '）';
const picked = (wakePick.eat ? 1 : 0) + (wakePick.play ? 1 : 0) + (wakePick.sleep ? 1 : 0);
$('wake-progress').textContent = '醒来三格：已选 ' + picked + '/3' +
(picked < 3 ? '（吃、玩、睡各选 1 格才能睡过去）' : '（已选满）');
$('btn-sleep').disabled = picked < 3;
const up = $('upgrade-box');
up.innerHTML = '';
UPGRADE_LINES.forEach((line) => {
const b = document.createElement('button');
const lv = S.upgrades[line.key];
const names = UPGRADE_LEVEL_NAMES[line.key];
b.textContent = lv >= UPGRADE_MAX_LEVEL
? line.label + '：' + names[lv - 1] + '（已满级）'
: line.label + '：' + names[lv - 1] + ' → ' + names[lv] + '（' + upgradeCost(line.key) + ' 结算资源）';
b.disabled = lv >= UPGRADE_MAX_LEVEL || S.settlement < upgradeCost(line.key);
b.onclick = () => doUpgrade(line.key);
up.appendChild(b);
});
renderPickGroup('eat-box', [
['kibble', '狗粮'], ['salmon', '三文鱼'], ['feast', '骨头大餐'],
], 'eat');
renderPickGroup('play-box', [
['park', '公园疯跑'], ['night-road', '夜路散步'],
['shelter', '收容所看看'], ['yard-corner', '院子角落转转'],
], 'play');
const sleepOpts = [['cardboard', '纸箱']];
if (S.upgrades.kennel >= 2) sleepOpts.push(['mat', '垫子']);
renderPickGroup('sleep-box', sleepOpts, 'sleep');
$('sleep-note').textContent =
'小床 / 狗别墅：狗窝升到 4 级就是别墅；纸箱之神需拥有别墅后连选 5 次纸箱。';
}

function renderPickGroup(boxId, opts, kind) {
const box = $(boxId);
box.innerHTML = '';
opts.forEach(([val, label]) => {
const b = document.createElement('button');
b.textContent = label;
b.disabled = wakePick[kind] === val;
b.onclick = () => {
wakePick[kind] = val;
const note = WAKE_PICK_NOTES[kind] && WAKE_PICK_NOTES[kind][val];
wakeNote((kind === 'eat' ? '吃：' : kind === 'play' ? '玩：' : '睡：') + label +
(note ? '——' + note : ''));
renderWake();
};
box.appendChild(b);
});
}

function renderCodex() {
const box = $('codex-box');
box.innerHTML = '';
Object.keys(CODEX).forEach((id) => {
const div = document.createElement('div');
div.className = 'codex-entry';
div.textContent = S.codex[id]
? CODEX[id].title + '：' + CODEX[id].text
: CODEX[id].title + '：???（未解锁）';
box.appendChild(div);
});
}

// Scene edge arrows (D23): cycle through unlocked scenes only, so the
// snowfield arrow never appears before the first wake unlocks it.
function updateSceneArrows() {
const prev = $('btn-scene-prev'), next = $('btn-scene-next');
if (!prev || !next) return;
const show = S.phase === 'dream' && S.scenesUnlocked.length > 1;
prev.style.display = show ? 'block' : 'none';
next.style.display = show ? 'block' : 'none';
}
function cycleScene(dir) {
const list = S.scenesUnlocked;
if (list.length < 2) return;
const i = list.indexOf(S.scene);
S.scene = list[(i + dir + list.length) % list.length];
save();
renderAll();
log('场景：' + (S.scene === 'snowfield' ? '雪原' : '草地'));
}

function renderAll() {
// The frame is always sized (aspect-ratio); the setup overlay covers it
// in the setup phase, and the wake overlay covers it in the wake phase.
$('setup').style.display = S.phase === 'setup'? 'block': 'none';
$('game').style.display = 'block';
$('dream-panel').style.display = S.phase === 'dream'? 'block': 'none';
$('wake-panel').style.display = S.phase === 'wake'? 'block': 'none';
$('phase-label').textContent =
S.phase === 'dream'? '梦里（' + (S.scene === 'snowfield'? '雪原': '草地') + '）':
S.phase === 'wake'? '醒着（现实小屋）': '选狗';
if (S.phase === 'dream') { renderHUD(); drawScene();}
if (S.phase === 'wake') { renderWake();}
updateSceneArrows();
renderCodex();
}

/* ---------------- setup / wiring ---------------- */

function pickBreed(breed) {
S.breed = breed;
document.querySelectorAll('#breed-box button').forEach((b) => {
b.disabled = b.dataset.breed === breed;
});
}

function startGame() {
if (!S.breed) { log('先选一个品种。'); return;}
const input = $('name-input').value.trim();
S.name = input || BREEDS[S.breed].name;
S.phase = 'dream';
save();
startDream();
log('你选了' + BREEDS[S.breed].name + '，名字是「' + S.name + '」。做个好梦。');
}

document.querySelectorAll('#breed-box button').forEach((b) => {
b.onclick = () => pickBreed(b.dataset.breed);
});
$('btn-start').onclick = startGame;
$('btn-sniff').onclick = doSniff;
$('btn-spend').onclick = doSpend;
$('btn-bury').onclick = doBury;
$('btn-wake').onclick = doWake;
$('btn-pet').onclick = petDog;
$('btn-auto').onclick = buyAuto;
$('btn-pin').onclick = () => {
if (S.pinned) S.pinned = null;
else S.pinned = autoObjective();
save();
renderHUD();
};
function togglePanel(id) {
const p = $(id);
p.style.display = p.style.display === 'none' ? 'block' : 'none';
}
$('btn-codex').onclick = () => { togglePanel('codex-panel'); renderCodex(); };
$('btn-howto').onclick = () => { togglePanel('howto-panel'); };
$('btn-log').onclick = () => { togglePanel('log-panel'); };
$('btn-close-codex').onclick = () => { $('codex-panel').style.display = 'none'; };
$('btn-close-howto').onclick = () => { $('howto-panel').style.display = 'none'; };
$('btn-close-log').onclick = () => { $('log-panel').style.display = 'none'; };
$('btn-reset').onclick = () => { $('confirm-panel').style.display = 'block'; };
$('btn-confirm-reset').onclick = () => { StorageAdapter.clear(); location.reload(); };
$('btn-cancel-reset').onclick = () => { $('confirm-panel').style.display = 'none'; };
$('btn-dismiss-banner').onclick = hideEvolutionBanner;
$('btn-scene-prev').onclick = () => cycleScene(-1);
$('btn-scene-next').onclick = () => cycleScene(1);
$('btn-sleep').onclick = applyWakePicks;

// Tick: buried maturity, HUD refresh, canvas redraw.
setInterval(() => {
if (S.phase === 'dream') {
checkBuried();
renderHUD();
drawScene();
}
}, 200);

// Per-frame loop: roaming dog, particles, and flying bones need smooth
// motion, which the 200ms tick cannot give. drawScene is idempotent
// (it only paints current state), so redrawing every frame is safe.
function frameLoop(now) {
if (S.phase === 'dream') {
const dt = lastFrameAt ? now - lastFrameAt : 16;
lastFrameAt = now;
updateDogMotion(now, dt);
tryWalkDig();
drawScene();
} else {
lastFrameAt = 0;
}
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frameLoop);
}
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frameLoop);

renderAll();
