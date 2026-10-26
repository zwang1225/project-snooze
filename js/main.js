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
const UPGRADE_COST = 100; // settlement per line, one level each in MVP
const CODEX_NEW_BONUS = 50; // D10 placeholder
const SHORT_DREAM_S = 180; // dreams under 3 minutes settle at 20%
const GLITCH_TAPS = 999; // taps before the small chance starts
const GLITCH_CHANCE = 0.01; // per tap after 999 (placeholder probability)

const UPGRADE_LINES = [
{ key: 'bowl', label: '饭盆', from: '破碗', to: '钢碗'},
{ key: 'kennel', label: '狗窝', from: '纸箱', to: '垫子'},
{ key: 'toy', label: '玩具', from: '破布', to: '球'},
{ key: 'yard', label: '院子', from: '没院子', to: '小院'},
];

const CODEX = {
hero: { title: '主角图鉴', text: '你选定的狗。它不会被重置，梦会清空，家不会。'},
'riddle-h02': { title: '???', text: '谜语：它在你一直点它的时候出现。'},
h02: { title: 'ERROR.PUP（乱码狗）', text: '全身花屏错位。它自己不知道自己坏了，照样刨坑摇尾巴，只是尾巴一摇就错位到头顶。'},
'sea-dream': { title: '海梦事件', text: '连吃 3 次三文鱼，下一场梦开出隐藏海梦。'},
'shadow-teaser': { title: '夜访影狗的影子', text: '见过它来过，还没见过它：夜里草地上一串湿脚印，远远闪过一个影子。H03 本体收服留后续版本。'},
'dream-flower': { title: '梦花', text: '总在院子同一个角落转悠，那块地长出了一朵梦花。'},
'cardboard-god': { title: '纸箱之神', text: '有狗别墅不住、连选 5 次纸箱睡，才能解锁。MVP 里狗窝最高只到垫子，此条仅记进度。'},
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
shadowTeaserSeen: false,
};
}

let S = StorageAdapter.load() || freshSave();
if (!S.version) S = freshSave();

// Transient (not saved): current scent points, selection, dig cooldown, animation.
let scentPoints = [];
let selectedPoint = null;
let lastDigAt = 0;
let digAnimUntil = 0;
let lastBuryLog = '';
// Readability: scent points stay hidden until the first sniff of a dream,
// and the evolution banner stays up until dismissed or the next action.
let scentsRevealed = false;

// Interaction pass (visual feedback only — no rules live here).
// Dog position is visible state on the 480x300 canvas: the dog box is
// 150x150 with its top at y=100, so dogX is the box CENTER x and the
// dog's feet land at y=250. The dog roams when nothing is selected
// and RUNS to the selected scent point's x when one is picked.
const DOG_BOX = 150, DOG_TOP = 100;
let dogX = 210, dogTargetX = null, dogPauseUntil = 0;
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
return { left: dogX - DOG_BOX / 2, top: DOG_TOP, size: DOG_BOX };
}

// Dog motion: RUNS to the selected scent point, otherwise wanders
// (walk to a random spot, pause, walk again). Called every frame with
// an explicit dt so it is deterministic under test.
function updateDogMotion(now, dtMs) {
if (S.phase !== 'dream') return;
if (selectedPoint) {
dogPauseUntil = 0;
const target = selectedPoint.x;
const step = 320 * dtMs / 1000;
if (Math.abs(target - dogX) <= step) { dogX = target; return; }
dogX += Math.sign(target - dogX) * step;
return;
}
if (dogTargetX === null) {
if (now < dogPauseUntil) return;
dogTargetX = 90 + Math.random() * 300; // wander within [90, 390]
return;
}
const step = 55 * dtMs / 1000;
if (Math.abs(dogTargetX - dogX) <= step) {
dogX = dogTargetX;
dogTargetX = null;
dogPauseUntil = now + 1000 + Math.random() * 2000;
return;
}
dogX += Math.sign(dogTargetX - dogX) * step;
}

function drawScene() {
const pal = scenePalette();
const now = Date.now();
ctx.fillStyle = pal.sky;
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = pal.ground;
ctx.fillRect(0, 200, canvas.width, 100);

// Scent-point markers on the ground (visible targets the dog runs to).
// Colors: strong amber, light green, strange purple; selected gets a ring.
if (scentsRevealed) {
const colors = { strong: '#c96a2b', light: '#7fb069', strange: '#9b5de5' };
scentPoints.forEach((p) => {
const col = colors[p.type] || '#888888';
ctx.fillStyle = col;
for (let i = 0; i < 3; i++) {
const wx = p.x - 8 + i * 8;
const wy = 232 + Math.sin(now / 300 + i) * 2;
ctx.fillRect(wx, wy, 3, 10);
}
if (selectedPoint === p) {
ctx.strokeStyle = '#ffd23b';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.ellipse(p.x, 248, 30, 10, 0, 0, Math.PI * 2);
ctx.stroke();
}
});
}

// Dig pits dug this dream (persist until the next dream starts).
holes.forEach((h) => {
ctx.fillStyle = pal.pit;
ctx.beginPath();
ctx.ellipse(h.x, 250, 26, 8, 0, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = pal.dirt;
ctx.beginPath();
ctx.ellipse(h.x, 250, 18, 5, 0, 0, Math.PI * 2);
ctx.fill();
});

// Bone pile, bottom-right: grows with this dream's bone count
// (visual only, capped at 8 sprites).
if (S.bones > 0) {
const n = Math.min(8, 1 + Math.floor(S.bones / 40));
for (let i = 0; i < n; i++) {
drawBonePixel(ctx, 415 + (i % 3) * 16, 272 + Math.floor(i / 3) * 10, 2, 'plain');
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
})) {
const bob = now < digAnimUntil? Math.sin(now / 60) * 4: 0;
drawDogSprite(ctx, S.breed, S.stage, 6, box.left + 39, 196 + bob, {
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
ctx.fillRect(px, py, 4, 4);
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
const fy = b.y0 + (b.y1 - b.y0) * p - Math.sin(Math.PI * p) * 30;
drawBonePixel(ctx, fx, fy, 3, b.tier);
});

// Shadow-teaser pawprints (D9 recipe 4, teaser form only).
if (S.shadowTeaserSeen && S.scene === 'meadow') {
ctx.fillStyle = 'rgba(90, 70, 48, 0.55)';
for (let i = 0; i < 4; i++) {
ctx.beginPath();
ctx.ellipse(60 + i * 26, 262 + (i % 2) * 8, 7, 4, 0, 0, Math.PI * 2);
ctx.fill();
}
}
// Meteor-night sparkle.
if (S.meteorNight) {
ctx.fillStyle = '#ffe97a';
for (let i = 0; i < 8; i++) {
const x = 20 + ((i * 53) % 440);
const y = 12 + ((i * 29) % 60);
ctx.fillRect(x, y, 3, 3);
}
}
}

// Clicking the dog counts as a tap (H02 counter). The Pet button does the same.
// The click box follows the roaming dog; the reaction (bounce + fast wag
// + hearts) is added ON TOP of the counter, never instead of it.
canvas.addEventListener('click', (e) => {
if (S.phase!== 'dream') return;
const r = canvas.getBoundingClientRect();
const x = (e.clientX - r.left) * (canvas.width / r.width);
const y = (e.clientY - r.top) * (canvas.height / r.height);
const box = dogBox();
if (x >= box.left && x <= box.left + box.size && y >= box.top && y <= box.top + box.size) petDog();
});

function petDog() {
const now = Date.now();
petReactUntil = now + 650; // happy bounce
petWagUntil = now + 2000; // faster tail wag for a moment
for (let i = 0; i < 3; i++) {
particles.push({ kind: 'heart', x: dogX - 20 + i * 20, y: 130,
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
// Each scent point gets a canvas x-position (spread across the ground)
// so the dog has somewhere visible to run to when it is selected.
const SCENT_SPOTS = [100, 240, 380];
scentPoints = types.map((t, i) => ({ type: t,...SCENT_TYPES[t],
x: SCENT_SPOTS[i] + Math.floor(Math.random() * 20) - 10 }));
selectedPoint = null;
}

let lastSniffAt = 0; // drives the sniff pulse in js/art.js (not a rule)
function doSniff() {
lastSniffAt = Date.now();
// The banner gives way to the next action (it was shown by a previous one).
hideEvolutionBanner();
scentsRevealed = true;
rollScentPoints();
gainXp(XP_PER_SNIFF);
log('闻到了 ' + scentPoints.length + ' 个味点：选一个，去刨。');
save();
renderDreamControls();
}

function selectPoint(i) {
selectedPoint = scentPoints[i];
dogTargetX = selectedPoint.x; // the dog RUNS to this spot, then digs there
log('选中：' + selectedPoint.label + '（' + selectedPoint.hint + '）。按“刨！”开挖。');
renderDreamControls();
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

function doDig() {
hideEvolutionBanner();
if (!selectedPoint) { log('先闻一闻，再选一个味点。'); return;}
const now = Date.now();
if (now - lastDigAt < selectedPoint.cooldownMs) return;
lastDigAt = now;
digAnimUntil = now + 500;
const got = digYield(selectedPoint);
// Visible dig feedback (numbers unchanged): a pit at the dog's spot,
// flying dirt, and a bone sprite that pops out and flies to the counter.
if (holes.length >= 24) holes.shift();
holes.push({ x: dogX });
for (let i = 0; i < 10; i++) {
particles.push({ kind: 'dirt', x: dogX, y: 245,
vx: -60 + Math.random() * 120, vy: -140 + Math.random() * 80,
born: now, life: 700 });
}
flyingBones.push({ x0: dogX, y0: 235, x1: 435, y1: 18,
born: now, dur: 650, tier: boneTierFor(got, lastDigRare) });
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
if (S.upgrades[lineKey] >= 2) return;
if (S.settlement < UPGRADE_COST) { log('结算资源不够：升级需要 ' + UPGRADE_COST + '。'); return;}
S.settlement -= UPGRADE_COST;
S.upgrades[lineKey] = 2;
wakeNote(line.label + '升级：' + line.from + ' → ' + line.to + '（家当升级，不占醒来名额）。');
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
log('纸箱之神进度：连选纸箱 ' + S.streaks.cardboard + ' 次（需先拥有狗别墅，MVP 暂未开放）。');
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
dogX = 210; dogTargetX = null; dogPauseUntil = 0;
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
cardboard: '纸箱：纸箱连选进度 +1（纸箱之神需先拥有狗别墅，MVP 仅记进度）。',
mat: '垫子：在垫子上睡（无跨局效果）。',
},
};

function renderHUD() {
const dogName = S.name || (S.breed && BREEDS[S.breed] ? BREEDS[S.breed].name : '');
$('hud').textContent =
(dogName ? dogName + ' · ' : '') +
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
const digBtn = $('btn-dig');
if (digBtn) {
const cd = selectedPoint? selectedPoint.cooldownMs: 0;
digBtn.disabled =!selectedPoint || (Date.now() - lastDigAt < cd);
}
const buriedPending = S.buried.reduce((a, b) => a + b.amount, 0);
$('bury-status').textContent = buriedPending
? '埋着 ' + buriedPending + ' 根骨头（60 秒后挖出变多）'
: '没埋骨头';
}

function renderDreamControls() {
const box = $('scent-box');
box.innerHTML = '';
// Scent points stay hidden until the first sniff of this dream; sniffing
// reveals them (and re-rolls on later sniffs).
if (!scentsRevealed) {
box.textContent = '按“闻一闻”找出味点。';
} else {
scentPoints.forEach((p, i) => {
const b = document.createElement('button');
const bonus = affinityBonus(S.breed, p.type);
b.textContent = p.label + '（' + p.hint + '）' +
(bonus? '（' + BREEDS[S.breed].line + '擅长 +' + bonus + '）' : '');
// Selected point: bright highlight + checkmark + "已选中".
// It must never look disabled, so it stays clickable and full-opacity.
if (selectedPoint === p) {
b.className = 'selected';
b.textContent += ' ✓ 已选中';
}
b.onclick = () => selectPoint(i);
box.appendChild(b);
});
}
$('scene-note').textContent =
S.scene === 'snowfield'
? '雪原场景：冰线朋友与冻土隐藏出现率更高（原型仅展示倾向说明）。'
: '草地场景：梦境草地是公共的，所有睡着的狗都来。';
const snowBtn = $('btn-snowfield');
snowBtn.disabled =!S.scenesUnlocked.includes('snowfield');
snowBtn.textContent = S.scenesUnlocked.includes('snowfield')
? '去雪原': '雪原（第一次醒来后解锁）';
}

function renderWake() {
const r = settlementBreakdown();
$('wake-breakdown').textContent =
'本梦总产出 ' + r.total + ' 根骨头 ×（1 + 0.1 × 最深层 ' + S.deepestLayer + '）' +
' + 新图鉴 ' + S.dreamCodexNew.length + ' × ' + CODEX_NEW_BONUS +
(r.short? ' → 短梦（< 3 分钟）只结算 20%': ' → 全额结算') +
(r.bonus? ' + 首醒教学奖励 ' + FIRST_WAKE_BONUS: '') +
' = 本次结算 ' + r.grand + '（当前持有 ' + S.settlement + '）';
const up = $('upgrade-box');
up.innerHTML = '';
UPGRADE_LINES.forEach((line) => {
const b = document.createElement('button');
const lv = S.upgrades[line.key];
b.textContent = lv >= 2
? line.label + '：' + line.to + '（MVP 已满级）'
: line.label + '：' + line.from + ' → ' + line.to + '（' + UPGRADE_COST + ' 结算资源）';
b.disabled = lv >= 2 || S.settlement < UPGRADE_COST;
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
'小床 / 狗别墅：MVP 狗窝最高只到垫子，暂未开放。纸箱之神需狗别墅，MVP 仅记进度。';
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

function renderAll() {
$('setup').style.display = S.phase === 'setup'? 'block': 'none';
$('game').style.display = S.phase === 'setup'? 'none': 'block';
$('dream-panel').style.display = S.phase === 'dream'? 'block': 'none';
$('wake-panel').style.display = S.phase === 'wake'? 'block': 'none';
$('phase-label').textContent =
S.phase === 'dream'? '梦里（' + (S.scene === 'snowfield'? '雪原': '草地') + '）':
S.phase === 'wake'? '醒着（现实小屋）': '选狗';
if (S.phase === 'dream') { renderHUD(); renderDreamControls(); drawScene();}
if (S.phase === 'wake') { renderWake();}
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
$('btn-dig').onclick = doDig;
$('btn-spend').onclick = doSpend;
$('btn-bury').onclick = doBury;
$('btn-wake').onclick = doWake;
$('btn-pet').onclick = petDog;
$('btn-dismiss-banner').onclick = hideEvolutionBanner;
$('btn-meadow').onclick = () => { S.scene = 'meadow'; save(); renderAll();};
$('btn-snowfield').onclick = () => { S.scene = 'snowfield'; save(); renderAll();};
$('btn-sleep').onclick = applyWakePicks;
$('btn-codex').onclick = () => {
const p = $('codex-panel');
p.style.display = p.style.display === 'none'? 'block': 'none';
renderCodex();
};
$('btn-reset').onclick = () => {
StorageAdapter.clear();
location.reload();
};

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
drawScene();
} else {
lastFrameAt = 0;
}
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frameLoop);
}
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frameLoop);

renderAll();
