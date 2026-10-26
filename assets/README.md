# project-snooze art assets — manifest

Full art batch, branch `art-full-set`. Source of truth for every design:
`docs/SPEC.md` + `docs/DECISIONS.md` (D8, all定稿 2026-10-25).

- **Scope: 23 idle keyframes** — 3 lines × 5 stages (001–005) + fusions
  F01–F04 + hidden H01–H04. **F00 像素原初神·D.O.G is NOT drawn**
  (D8: v1 gets not even a silhouette).
- **No frame sequences.** Animation is delivered via layers + code motion
  (see "Animation readiness" below), because AI frame sequences drift
  (face/tail change between frames).
- **Pipeline (D13):** generate (free only) → pixelize/clean →入库.
  Every PNG here is 96×96, NEAREST-resized, ≤32 colors.
- **Cost: $0.** All generation used the built-in free image tool only.
  No Gemini CLI, no paid runs.
- **Shared style block** (verbatim in every generation prompt): retro
  pixel-art game sprite, crisp square pixels, limited restrained color
  palette, no anti-aliasing, no soft gradients, single dog character
  centered and fully visible, facing forward, idle standing pose, plain
  solid background, no text, no watermark. Keyframes use a pale-grey
  background; layers use bright green (#00FF00) for chroma-keying.
- **Same face per line:** each line repeats one face descriptor in every
  prompt (gear/size/glow change, never the face). Cross-evolution face
  consistency is approximate — each generation is independent, so faces
  vary slightly (see per-sprite notes).

## How to use the layers (read this before compositing)

**Layers are NOT drop-in 1:1 overlays.** The generator re-centers each
layer element in its own frame (tails and gear come out large and
centered), so a layer pasted 1:1 over its keyframe will cover the dog.
Code must: (1) chroma-key #00FF00 → transparent (all shipped layers
have near-green snapped to exact (0,255,0) at assembly time, so keying
is exact); (2) scale the layer down; (3) anchor it to its keyframe
position (tail at the rear/base, crown on the head, sword at the
mouth, halo above the head). Test each composite before shipping.
Two layers need extra work in code: `shadow-003-gear.png` (headband
and scroll are stacked in one image — split them: headband to the
head, scroll to the mouth) and `fusion-f01-gear.png` (exploded sheet:
crown top, cape bottom, horn left, staff right — crop and reposition
each piece, do not overlay whole).

## Keyframes

| File | D8 name | Design notes | Prompt (short form) |
|---|---|---|---|
| `dogs/light-001.png` | 奶团子 (light 001) | Small round white furball, pink paws, eyes half-open | style + white fluffy Pomeranian face + small round furball puppy, pink paws, eyes half-open, sleepy |
| `dogs/light-002.png` | 奶凶博美 (light 002) | Fur puffed/bristling, grumpy fierce act; individual teeth not resolved at 96×96 | style + Pom face + puffed bristling fur, baring tiny teeth pretending fierce, still a small round ball |
| `dogs/light-003.png` | 叼剑毛球 (light 003) | Wooden sword in mouth + helmet knocked askew by ears, both legible; nose emphasis subtle | style + Pom face + small wooden sword in mouth, small helmet knocked askew by pointy ears, nose highlighted sniffing |
| `dogs/light-004.png` | 舔舔大祭司 (light 004) | Tall crown + plush cape clear; tongue reads as small open pink mouth at this size | style + Pom face + tall crown, plush cape, tongue always sticking out |
| `dogs/light-005.png` | 天界绒神 (light 005) | Sits upright on cloud rather than flat on belly; cloud + biscuit-ring halo both clear | style + Pom face + floating on belly on small cloud, halo is ring of floating dog biscuits |
| `dogs/ice-001.png` | 小二哈 (ice 001) | Head tilt, goofy cheerful face; heterochromia barely legible at 96×96 | style + ice-blue-grey Husky face, heterochromatic eyes, 3 flame forehead markings + head tilt |
| `dogs/ice-002.png` | 拆家狂魔 (ice 002) | Sofa corner in mouth, feathers/sponge flying, shameless cheeky face | style + Husky face + sofa corner in mouth, feathers and sponge bits flying, shameless face |
| `dogs/ice-003.png` | 雪橇队长 (ice 003) | Harness + little sled, tongue flopping to side, mid-rush | style + Husky face + chest harness, little sled behind, tongue flopping to side |
| `dogs/ice-004.png` | 极地狼王 (ice 004) | Ice-crystal crown, lion-like mane collar, majestic pose, goofy face | style + Husky face + ice-crystal crown, thick lion-like mane collar |
| `dogs/ice-005.png` | 极地机甲狼神 (ice 005) | Half ice armor / half mecha, red scanning eye; chew stick in chest cabin is small/baked-in | style + Husky face + half ice armor half mecha, red scanning eye, mecha tail, chew stick in cabin |
| `dogs/shadow-001.png` | 倔头柴 (shadow 001) | Paws planted, straight stubborn neck, taut vertical leash, curled tail | style + orange-black Shiba face + paws planted, neck straight stubborn, leash pulled taut |
| `dogs/shadow-002.png` | 表情包柴 (shadow 002) | Keyframe = side-eye contempt face (face rotation is animation, not this batch) | style + Shiba face + drama queen, side-eye contempt |
| `dogs/shadow-003.png` | 忍者柴 (shadow 003) | Headband, scroll in mouth, grass at feet; keyframe also shows a second small curl at feet — the tail-tip reads ambiguously | style + Shiba face + headband, scroll in mouth, curled tail tip in grass, stealthy |
| `dogs/shadow-004.png` | 影之主公 (shadow 004) | COMPROMISE: stands dignified on the platform instead of seated; outfit, sword, platform correct | style + Shiba face + black warrior outfit, sword at waist, high platform, dignified/aloof |
| `dogs/shadow-005.png` | 九尾柴神 (shadow 005) | Tails unambiguously spiral curls (not fox/flame); overlapping curls read as ~10–11 spirals — the tail layer is the authoritative 9 | style + Shiba face + NINE tails, each a different tight spiral curl, NEVER fox/flame tails |
| `dogs/fusion-f01.png` | 霜绒双锋骑士 (F01) | Wolf-king build, plush priest cape, ice crown + small tall crown, light staff in mouth + ice horn, tongue out | style + wolf-king build, plush priest cape, ice-crystal crown with small tall crown on top, light staff in mouth, ice-crystal horn |
| `dogs/fusion-f02.png` | 霜光天狼 (F02) | Mecha wolf, cloud fur, crystal-biscuit halo, red scanning eye | style + mecha wolf draped in cloud fur, halo of biscuits frozen into crystal biscuits, red scanning eye |
| `dogs/fusion-f03.png` | 日蚀神犬 (F03) | Half golden-white / half orange-black; tails spiral curls (verified, not fox); glowing tails read cyan/sparkle, glowing count approximate (~5 of 9) | style + half golden-white half orange-black, nine spiral-curled tails half glowing |
| `dogs/fusion-f04.png` | 永夜猎手 (F04) | Mecha wolf, night-vision glowing eyes, curled tail held out as bait | style + mecha wolf, night-vision glowing eyes, curled tail as bait, dark night mood |
| `dogs/hidden-h01.png` | 初心奶狗 (H01) | Tiny baby-puppy body, one small flower on head, calm steady eyes | style + tiny baby-puppy body, one small flower on head, calm steady eyes |
| `dogs/hidden-h02.png` | 乱码狗 ERROR.PUP (H02) | Glitched/misaligned body, RGB-shift blocks, tail glitching toward head, cheerful pose | style + whole body glitched misaligned, RGB-shift corrupted pixels, tail glitching to top of head |
| `dogs/hidden-h03.png` | 夜访影狗 (H03) | Translucency SIMULATED (dark ghostly look, no true alpha); glowing eyes + solid tail tip are the solid elements | style + semi-transparent dark shadow dog, glowing eyes, solid tail tip only |
| `dogs/hidden-h04.png` | 闪光金狗 (H04) | VERIFIED: entire coat metallic gold (head, ears, body, legs, tail), not gold trim; star ring separate | style + entire coat metallic gold, ring of little star particles |

## Layers

All in `dogs/layers/`, 96×96, bright-green (#00FF00) background,
chroma-key to transparent in code, then scale + anchor (see caveat
above). Tail layers are the minimum for every sprite that has one.

| Sprite | Tail layer | Gear / halo layer |
|---|---|---|
| light-001 | `layers/light-001-tail.png` (large curled white fluff) | — |
| light-002 | `layers/light-002-tail.png` (bristling white plume) | — |
| light-003 | `layers/light-003-tail.png` (small curled white tail, cleanest) | `layers/light-003-gear.png` (sword + helmet side-by-side — crop/place each separately) |
| light-004 | `layers/light-004-tail.png` (small curled tail tip; first attempt failed as body+cape, retried once) | `layers/light-004-gear.png` (tall gold crown + wide white cape — cape goes behind body) |
| light-005 | `layers/light-005-tail.png` (curled white tail) | `layers/light-005-halo.png` (cloud + ring of 10 biscuits — re-center ring above head, do not overlay 1:1) |
| ice-001 | `layers/ice-001-tail.png` (fluffy curled tail) | — |
| ice-002 | `layers/ice-002-tail.png` | `layers/ice-002-gear.png` (torn sofa corner + feathers + sponge bits) |
| ice-003 | `layers/ice-003-tail.png` | `layers/ice-003-gear.png` (chest harness + little sled at bottom) |
| ice-004 | `layers/ice-004-tail.png` | `layers/ice-004-gear.png` (ice-crystal crown + sparkles; best layer of its batch) |
| ice-005 | `layers/ice-005-tail.png` (real + mecha tail in ONE layer — they wag together) | — (armor is body-attached, skipped by design) |
| shadow-001 | `layers/shadow-001-tail.png` (single spiral curl) | `layers/shadow-001-gear.png` (taut vertical leash, loop top, clip bottom) |
| shadow-002 | `layers/shadow-002-tail.png` (single spiral curl) | — |
| shadow-003 | `layers/shadow-003-tail.png` (single large spiral curl; v1 failed as double figure-8 curl, retried once) | `layers/shadow-003-gear.png` (headband + scroll stacked — SPLIT in code: headband to head, scroll to mouth) |
| shadow-004 | `layers/shadow-004-tail.png` (single spiral disc) | `layers/shadow-004-gear.png` (diagonal black-and-gold sheathed sword) |
| shadow-005 | `layers/shadow-005-tail.png` (EXACTLY 9 stalks, each a different tight spiral curl — authoritative nine-tail asset) | — |
| fusion-f01 | `layers/fusion-f01-tail.png` (single bushy curved grey/white wolf tail; attempt 1 failed as fur band, retried once) | `layers/fusion-f01-gear.png` (EXPLODED SHEET: crown top, cape bottom, horn left, staff right — crop/reposition, do not overlay whole) |
| fusion-f02 | — FAILED (see below) | `layers/fusion-f02-halo.png` (ring of crystal bone-biscuits, fills frame — scale down to head halo) |
| fusion-f03 | `layers/fusion-f03-tail.png` (all nine spiral curls, half glowing gold — verified NOT fox tails) | — |
| fusion-f04 | `layers/fusion-f04-tail.png` (segmented mecha curled tail, large in frame — scale down) | — |
| hidden-h01 | `layers/hidden-h01-tail.png` (tiny puppy tail nub, very small in frame — scale up / offset) | — FAILED (see below) |
| hidden-h02 | `layers/hidden-h02-tail.png` (glitched vertical tail with shifted pixel blocks, rising toward head) | — |
| hidden-h03 | `layers/hidden-h03-tail.png` (just the solid tail tip, small black shape + glowing tip, centered low — offset to keyframe tail position) | — |
| hidden-h04 | `layers/hidden-h04-tail.png` (gold fluffy tail plume) | `layers/hidden-h04-halo.png` (clean ring of little gold star particles) |

Ears layers: 0/23. Ears are part of the head silhouette in every
keyframe, not a detachable accessory — a generated ears-only layer
would double-draw and misalign. Ear motion (if wanted) must come from
code, not from this batch.

## Animation notes (what moves in code, per sprite)

- **light-001:** tail wag ±12° around tail base + slow 2px body bob; eyes stay half-open (no blink frame).
- **light-002:** tail bristle-shake ±8° fast + 1px scale pulse (100%↔103%); body planted; face static.
- **light-003:** tail wag ±15°; sword (cropped from gear) bobs 2px at mouth, tilt ±5°; helmet (cropped from gear) wobbles ±6°; ears static.
- **light-004:** tail wag ±10° (mostly hidden behind cape); crown bobs 1px, tilts ±3°; cape sways 2px side-to-side; tongue static.
- **light-005:** whole-sprite float 3px sine; halo biscuit ring rotates slowly around head center (crop/offset ring above head; cloud stays under body); tail wag ±10°.
- **ice-001:** tail wag ±15° around base (anchored at rear, scaled to keyframe tail size); body bob 2px; head tilt/face baked.
- **ice-002:** tail wag ±15°; sofa-corner gear bobs 1–2px with jaw; body bob 2px; feathers baked into gear.
- **ice-003:** tail wag ±15°; harness+sled gear slides 2px back-and-forth (rush bounce) + body bob 2px; tongue baked.
- **ice-004:** tail wag ±15°; crown gear bobs 1px + opacity pulse for sparkle; mane/face baked.
- **ice-005:** tail wag ±10° (real + mecha tails in one layer, wag together); body bob 2px; red eye + chew stick baked.
- **shadow-001:** body bob 2px (y ±1px) + tail rotate ±12° around base; leash gear static, max 1px sway, never slack.
- **shadow-002:** tail rotate ±15° + body bob 1px; face static (no blink/eye layer).
- **shadow-003:** tail small fast twitch ±8° (tail-tip twitch); headband + scroll gear static.
- **shadow-004:** tail slow dignified wag ±8° + body bob 1px; sword gear static.
- **shadow-005:** whole nine-tail layer sway ±6° around fan base + body bob 2px; individual-tail wiggle NOT possible from the single fan layer.
- **fusion-f01:** tail wag ±15° around base; gear: crop/reposition crown, cape, staff, horn, then bob ±2px; body static.
- **fusion-f02:** NO tail layer — whole-sprite sway ±2px + slow rotate/bob of halo (scaled to head size) + red-eye pulse via opacity/tint blink.
- **fusion-f03:** tails wiggle/rotate ±10° around centre + pulse glowing tails' opacity; body static.
- **fusion-f04:** bait lure: sway tail ±15° (scaled down) + pulse night-vision eye glow.
- **hidden-h01:** tail tiny wag ±10°; flower: gentle ±1–2px bob using ONLY the flower cropped from the gear raw (the shipped gear file failed — see below, never overlay it whole).
- **hidden-h02:** glitch flicker: randomly offset horizontal slices of tail + whole keyframe by a few px + brief RGB-shift jitter on a short random timer.
- **hidden-h03:** passing-through: drift tail tip sideways with body + fade whole-sprite opacity in/out + pulse tail-tip glow.
- **hidden-h04:** tail wag ±15° around base + slow rotate halo + twinkle via opacity pulse.

## Failures (not shipped, or shipped with a workaround)

- **fusion-f02-tail:** generation call failed on an integrity check;
  per the brief it was not retried in any form. Only a `.json` stub
  exists in staging (not shipped). f02 animates via body sway + halo
  + eye pulse (see note above).
- **hidden-h01-gear:** the generated "gear" image contains a full
  puppy head/face, not just the flower — it is NOT shipped and must
  never be overlaid whole. The flower itself (pink, top-centre) is
  usable only if cropped out of the gear raw file (kept in staging,
  not shipped). h01's flower animation therefore depends on that
  crop; otherwise the flower stays static.
- **Ears layers:** skipped for all 23 by judgment (see above).
- **shadow-003-tail v1, light-004-tail v1, fusion-f01-tail v1:**
  first attempts failed (double curl / body+cape / fur band) and
  were discarded after one simplified retry each; shipped files are
  the retries. Failed raws remain in staging only.

## Animation readiness (summary)

- Keyframes: **23/23** shipped.
- Sprites with a real tail layer: **22/23** (all except fusion-f02).
- Sprites with a gear/halo layer: **12/23** (light-003, light-004,
  light-005, ice-002, ice-003, ice-004, shadow-001, shadow-003,
  shadow-004, fusion-f01, fusion-f02, hidden-h04).
- Sprites with keyframe + code note only (no usable layer for their
  signature motion): **fusion-f02** (tail), **hidden-h01** (flower,
  pending a crop from raw).
- **Nothing is fully un-animatable for basic motion** — every sprite
  can at minimum bob/sway/fade/pulse from its keyframe + note. The
  motions that are NOT possible from this batch: ear flop anywhere
  (no ears layers); independent wag of the two ice-005 tails
  (one combined layer); individual wiggle of shadow-005's or
  fusion-f03's nine tails (single fan layers); tongue motion on
  light-004 / ice-003 (tongues baked into keyframes).
- **Biggest integration risk:** layer alignment. Every layer needs
  manual scale + anchor against its keyframe (see caveat at top).
  Do not ship a composite without eyeballing it first.
