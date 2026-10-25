// Programmatic pixel placeholders (D13: $0, drawn in code, no assets).
// One base dog body per breed palette; stage differences are accessory
// overlays, so the dog's face never changes (spec: evolution changes
// equipment / size / glow, not the face).
'use strict';

// 12x9 pixel map. Chars: B body, b body-dark, E ear, T tail, K eye/nose,
// W white patch, P pink. '.' is transparent.
const DOG_MAP = [
  '....EE..EE..',
  '...EBBBBEB..',
  '..EBBBBBBB..',
  '.TBBBBBBBWK.',
  '.TBBBBBBBW..',
  '..BBBBBBB...',
  '..bBBBBBb...',
  '...BB..BB...',
  '...B....B...',
];

const BREED_PALETTES = {
  pomeranian: { B: '#f5e9c8', b: '#d9c08a', E: '#f5e9c8', T: '#ffffff', K: '#222222', W: '#ffffff', P: '#f2a0b5' },
  husky:      { B: '#c8d4e0', b: '#8fa3b8', E: '#c8d4e0', T: '#eef4f8', K: '#222222', W: '#ffffff', P: '#f2a0b5' },
  shiba:      { B: '#e8a34c', b: '#b87a2e', E: '#e8a34c', T: '#f5e9c8', K: '#222222', W: '#f5e9c8', P: '#f2a0b5' },
};

// Stage accessory overlays, drawn after the base map.
// stage 2: spikier top fur + a fiercer brow line.
// stage 3 (per breed, from the D8 final designs):
//   pomeranian: helmet pushed askew + wooden sword carried in the mouth.
//   husky: sled harness + a small sled behind.
//   shiba: headband + a scroll carried in the mouth.
function drawDogSprite(ctx, breed, stage, px, ox, oy, opts) {
  opts = opts || {};
  const pal = BREED_PALETTES[breed];
  const glitch = !!opts.glitch;
  const glitchColors = ['#ff00ff', '#00ffff', '#ffff00', '#ff3300', '#00ff66'];

  function colorFor(ch) {
    if (glitch && ch !== '.' && Math.random() < 0.45) {
      return glitchColors[Math.floor(Math.random() * glitchColors.length)];
    }
    return pal[ch] || '#000000';
  }

  // Glitch variant: draw the map in horizontal slices with random offsets
  // (spec H02: the dog does not know it is broken; it still digs and wags,
  //  its tail just misaligns onto its head when it wags).
  DOG_MAP.forEach((row, y) => {
    const sliceDx = glitch ? Math.floor(Math.random() * 7) - 3 : 0;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = colorFor(ch);
      ctx.fillRect(ox + (x + sliceDx) * px, oy + y * px, px, px);
    }
  });

  const bodyW = 12 * px;
  const bodyH = 9 * px;

  if (stage >= 2) {
    // Spiky top fur.
    ctx.fillStyle = pal.B;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(ox + (3 + i * 2) * px, oy - px, px, px);
    }
    // Angry brow over the eye.
    ctx.fillStyle = '#222222';
    ctx.fillRect(ox + 9 * px, oy + 2 * px, 2 * px, px);
  }

  if (stage >= 3) {
    if (breed === 'pomeranian') {
      // Helmet, pushed askew by the ears.
      ctx.fillStyle = '#c0c8d0';
      ctx.fillRect(ox + 3 * px, oy - 2 * px, 6 * px, 2 * px);
      ctx.fillRect(ox + 2 * px, oy - px, 8 * px, px);
      // Wooden sword carried in the mouth (dogs carry things in the mouth).
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(ox + 10 * px, oy + 4 * px, 4 * px, px);
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(ox + 14 * px, oy + 4 * px, px, px);
    } else if (breed === 'husky') {
      // Sled harness straps.
      ctx.fillStyle = '#7a4a21';
      ctx.fillRect(ox + 2 * px, oy + 4 * px, px, 4 * px);
      ctx.fillRect(ox + 6 * px, oy + 4 * px, px, 4 * px);
      // Small sled behind.
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(ox - 4 * px, oy + 7 * px, 4 * px, px);
      ctx.fillRect(ox - 4 * px, oy + 5 * px, px, 3 * px);
    } else if (breed === 'shiba') {
      // Headband.
      ctx.fillStyle = '#d23b2e';
      ctx.fillRect(ox + 3 * px, oy + 1 * px, 7 * px, px);
      // Scroll carried in the mouth.
      ctx.fillStyle = '#f5e9c8';
      ctx.fillRect(ox + 10 * px, oy + 4 * px, 3 * px, 2 * px);
    }
  }

  if (opts.glow) {
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 2, oy - 2, bodyW + 4, bodyH + 4);
  }
}
