'use strict';

// ── CANVAS ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');

const GW = 480;
const GH = 320;
canvas.width  = GW;
canvas.height = GH;

function resize() {
  const scale = Math.min(window.innerWidth / GW, window.innerHeight / GH);
  canvas.style.width  = Math.floor(GW * scale) + 'px';
  canvas.style.height = Math.floor(GH * scale) + 'px';
}
resize();
window.addEventListener('resize', resize);

// ── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  cream:   '#FAF3E8',
  sage:    '#B8D9B2',
  sageD:   '#8AB884',
  rose:    '#F4A8A8',
  biscuit: '#E8C9A0',
  ink:     '#2C2416',
  white:   '#FFFDF8',
  tomato:  '#E8604A',
  tan:     '#C9A87C',
};

// ── LAYOUT ───────────────────────────────────────────────────────────────────
const PW      = 30;   // player width
const PH      = 22;   // player height
const PX      = 64;   // player fixed X
const CW      = 30;   // cat width
const CH      = 24;   // cat height
const HPAD    = 4;    // hitbox shrink per side (forgiveness)
const FLOOR_Y = GH - 62;  // top-y of player/cat when on floor  (258)
const CEIL_Y  = 40;        // top-y of player/cat when on ceiling

// ── STATE ────────────────────────────────────────────────────────────────────
let state, onFloor, score, highScore, elapsed, scoreAcc, nextMilestone;
let cats, spawnTimer;

highScore = +(localStorage.getItem('kd_hi') || 0);

// ── INPUT ────────────────────────────────────────────────────────────────────
function onInput() {
  if (state === 'start' || state === 'gameover') {
    initGame();
  } else {
    onFloor = !onFloor;
  }
}

document.addEventListener('keydown', e => {
  if ([' ', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
    e.preventDefault();
    onInput();
  }
});
canvas.addEventListener('pointerdown', e => { e.preventDefault(); onInput(); });

// ── INIT ─────────────────────────────────────────────────────────────────────
function initGame() {
  state         = 'playing';
  onFloor       = true;
  score         = 0;
  elapsed       = 0;
  scoreAcc      = 0;
  nextMilestone = 10;
  cats          = [];
  spawnTimer    = 2200; // ms grace before first cat
}

state = 'start'; // begin on start screen

// ── DIFFICULTY ───────────────────────────────────────────────────────────────
function spawnInterval() {
  if (elapsed < 10) return 2500;
  if (elapsed < 25) return 1800;
  if (elapsed < 45) return 1200;
  if (elapsed < 60) return  800;
  return 500;
}

function spawnCat() {
  // First 20 s: floor cats only; after: 30 % chance ceiling
  const atFloor = elapsed < 20 ? true : Math.random() > 0.3;
  cats.push({
    x:       GW,          // enter from right edge after warning
    y:       atFloor ? FLOOR_Y : CEIL_Y,
    atFloor,
    warn:    true,
    warnMs:  700,
    frame:   0,
    frameMs: 0,
    scored:  false,
  });
}

// ── DRAW HELPERS ─────────────────────────────────────────────────────────────
function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function textC(text, y, font, color) {
  ctx.font      = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, GW / 2, y);
  ctx.textAlign = 'left';
}

// ── SPRITE: RAT ──────────────────────────────────────────────────────────────
// For the ceiling rat, flip vertically around the sprite's centre.
function drawRat(x, y, flip) {
  ctx.save();
  if (flip) {
    ctx.translate(x + PW / 2, y + PH / 2);
    ctx.scale(1, -1);
    ctx.translate(-(x + PW / 2), -(y + PH / 2));
  }

  // Ears (behind head)
  rect(x + 2,  y - 5, 7, 7, C.tan);
  rect(x + 21, y - 5, 7, 7, C.tan);
  rect(x + 3,  y - 4, 5, 5, C.rose);
  rect(x + 22, y - 4, 5, 5, C.rose);

  // Body
  rect(x + 1, y + 4, PW - 2, PH - 6, C.biscuit);

  // Head bump
  rect(x + 4, y,     22, 10, C.biscuit);

  // Ink outline (body)
  ctx.strokeStyle = C.ink;
  ctx.lineWidth   = 1;
  ctx.strokeRect(x + 1.5, y + 4.5, PW - 3, PH - 7);
  ctx.strokeRect(x + 4.5, y + 0.5, 21, 9);

  // Eyes
  rect(x + 7,  y + 1, 4, 4, C.ink);
  rect(x + 19, y + 1, 4, 4, C.ink);
  rect(x + 8,  y + 2, 2, 2, C.white); // shine
  rect(x + 20, y + 2, 2, 2, C.white);

  // Nose
  rect(x + 13, y + 5, 4, 3, C.rose);
  rect(x + 14, y + 7, 2, 1, C.ink);

  // Blush cheeks
  ctx.globalAlpha = 0.45;
  rect(x + 5,  y + 5, 4, 3, C.rose);
  rect(x + 21, y + 5, 4, 3, C.rose);
  ctx.globalAlpha = 1;

  // Feet
  rect(x + 2,  y + PH - 5, 7, 4, C.tan);
  rect(x + 21, y + PH - 5, 7, 4, C.tan);

  // Tail (short curl to the right)
  rect(x + PW,     y + 11, 5, 2, C.tan);
  rect(x + PW + 3, y + 8,  2, 5, C.tan);

  ctx.restore();
}

// ── SPRITE: CAT ──────────────────────────────────────────────────────────────
// frame 0: arms/legs spread wide; frame 1: arms up, legs diagonal.
// For ceiling cats, flip vertically around sprite centre.
function drawCat(x, y, atFloor, frame) {
  ctx.save();
  if (!atFloor) {
    ctx.translate(x + CW / 2, y + CH / 2);
    ctx.scale(1, -1);
    ctx.translate(-(x + CW / 2), -(y + CH / 2));
  }

  // Head
  rect(x + 7,  y,     16, 14, C.cream);
  // Body
  rect(x + 3,  y + 10, 24, 13, C.cream);

  // Ink outline
  ctx.strokeStyle = C.ink;
  ctx.lineWidth   = 1;
  ctx.strokeRect(x + 7.5,  y + 0.5,  15, 13);
  ctx.strokeRect(x + 3.5,  y + 10.5, 23, 12);

  // Ears
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 4, y - 7); ctx.lineTo(x + 13, y); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(x + 26, y - 7); ctx.lineTo(x + 17, y); ctx.closePath(); ctx.fill();

  // Inner ears
  ctx.fillStyle = C.rose;
  ctx.beginPath(); ctx.moveTo(x + 9, y); ctx.lineTo(x + 6, y - 4); ctx.lineTo(x + 13, y); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 21, y); ctx.lineTo(x + 24, y - 4); ctx.lineTo(x + 17, y); ctx.closePath(); ctx.fill();

  // Eyes
  rect(x + 10, y + 3, 4, 4, C.ink);
  rect(x + 16, y + 3, 4, 4, C.ink);
  rect(x + 11, y + 4, 2, 2, C.white);
  rect(x + 17, y + 4, 2, 2, C.white);

  // Nose
  rect(x + 13, y + 8, 4, 3, C.rose);
  rect(x + 14, y + 10, 2, 1, C.ink);

  // Blush
  ctx.globalAlpha = 0.4;
  rect(x + 8,  y + 8, 4, 3, C.rose);
  rect(x + 18, y + 8, 4, 3, C.rose);
  ctx.globalAlpha = 1;

  // Splayed limbs — two animation frames
  ctx.strokeStyle = C.ink;
  ctx.lineWidth   = 1;
  if (frame === 0) {
    // Arms wide
    rect(x,      y + 11, 4, 4, C.cream); ctx.strokeRect(x + 0.5,      y + 11.5, 3, 3);
    rect(x + 26, y + 11, 4, 4, C.cream); ctx.strokeRect(x + 26.5,     y + 11.5, 3, 3);
    // Legs wide
    rect(x + 1,  y + 20, 7, 3, C.cream); ctx.strokeRect(x + 1.5,      y + 20.5, 6, 2);
    rect(x + 22, y + 20, 7, 3, C.cream); ctx.strokeRect(x + 22.5,     y + 20.5, 6, 2);
  } else {
    // Arms up-ish
    rect(x + 1,  y + 6,  4, 4, C.cream); ctx.strokeRect(x + 1.5,      y + 6.5,  3, 3);
    rect(x + 25, y + 6,  4, 4, C.cream); ctx.strokeRect(x + 25.5,     y + 6.5,  3, 3);
    // Legs angled
    rect(x + 3,  y + 21, 6, 3, C.cream); ctx.strokeRect(x + 3.5,      y + 21.5, 5, 2);
    rect(x + 21, y + 21, 6, 3, C.cream); ctx.strokeRect(x + 21.5,     y + 21.5, 5, 2);
  }

  ctx.restore();
}

// ── BACKGROUND ───────────────────────────────────────────────────────────────
function drawBG() {
  // Cream top half, sage bottom half
  rect(0, 0,      GW, GH / 2, C.cream);
  rect(0, GH / 2, GW, GH / 2, C.sage);

  // Decorative shelf silhouette
  ctx.fillStyle = C.tan;
  ctx.fillRect(80,  GH / 2 - 7, 110, 7);
  ctx.fillRect(272, GH / 2 - 7, 74,  7);
  ctx.fillStyle = C.sageD;
  ctx.fillRect(80,  GH / 2, 110, 3);
  ctx.fillRect(272, GH / 2, 74,  3);

  // Floor line
  rect(0, FLOOR_Y + PH + 4, GW, 3, C.sageD);
  // Ceiling line
  rect(0, CEIL_Y  - 5,       GW, 3, C.tan);
}

// ── HUD ──────────────────────────────────────────────────────────────────────
function drawHUD() {
  // Score pill
  ctx.fillStyle = C.ink;
  rrect(GW / 2 - 50, 6, 100, 26, 8);
  ctx.fill();
  textC(String(score).padStart(5, '0'), 25, 'bold 15px monospace', C.cream);

  // Best score — top right corner
  if (highScore > 0) {
    ctx.font      = '10px monospace';
    ctx.fillStyle = C.sageD;
    ctx.textAlign = 'right';
    ctx.fillText('BEST ' + highScore, GW - 6, 18);
    ctx.textAlign = 'left';
  }
}

// ── START SCREEN ─────────────────────────────────────────────────────────────
function drawStart() {
  drawBG();

  // Animated cats on the screen as decoration
  const f = Math.floor(Date.now() / 420) % 2;
  drawCat(GW / 2 - 90, GH / 2 - 96, true, f);
  drawCat(GW / 2 + 48, GH / 2 - 96, true, 1 - f);

  // Title box
  ctx.fillStyle = C.ink;
  rrect(GW / 2 - 124, GH / 2 - 56, 248, 46, 10);
  ctx.fill();
  textC('KITTY  DROP', GH / 2 - 22, 'bold 26px monospace', C.cream);

  textC('Dodge the falling cats!', GH / 2 + 8, '12px monospace', C.ink);

  // Prompt box
  ctx.fillStyle = C.ink;
  rrect(GW / 2 - 116, GH / 2 + 22, 232, 28, 8);
  ctx.fill();
  textC('CLICK  ·  TAP  ·  SPACE', GH / 2 + 41, 'bold 11px monospace', C.biscuit);

  if (highScore > 0) {
    textC('BEST: ' + highScore, GH / 2 + 70, '11px monospace', C.sageD);
  }
}

// ── GAME OVER SCREEN ─────────────────────────────────────────────────────────
function drawGameOver() {
  drawBG();

  // Dark overlay
  ctx.fillStyle = 'rgba(44,36,22,0.78)';
  ctx.fillRect(0, 0, GW, GH);

  // Big splayed cat (centred)
  drawCat(GW / 2 - CW / 2, GH / 2 - 84, true, 0);

  textC('GAME  OVER',   GH / 2 - 28, 'bold 24px monospace', C.tomato);
  textC('SCORE  ' + score, GH / 2 + 8,  'bold 20px monospace', C.cream);
  textC('BEST   ' + highScore, GH / 2 + 34, '13px monospace',      C.biscuit);

  // Blinking restart prompt
  if (Math.floor(Date.now() / 550) % 2 === 0) {
    textC('[ TAP TO TRY AGAIN ]', GH / 2 + 66, 'bold 12px monospace', C.sage);
  }
}

// ── COLLISION ────────────────────────────────────────────────────────────────
function playerBox() {
  const py = onFloor ? FLOOR_Y : CEIL_Y;
  return { x: PX + HPAD, y: py + HPAD, w: PW - HPAD * 2, h: PH - HPAD * 2 };
}

function catBox(cat) {
  return { x: cat.x + HPAD, y: cat.y + HPAD, w: CW - HPAD * 2, h: CH - HPAD * 2 };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── GAME LOOP ─────────────────────────────────────────────────────────────────
let lastTs = 0;

function tick(ts) {
  if (!lastTs) lastTs = ts;
  const dtMs = Math.min(ts - lastTs, 100); // cap at 100 ms to handle tab-blur spikes
  const dt   = dtMs / 1000;
  lastTs     = ts;

  // ── UPDATE ───────────────────────────────────────────────────────────────
  if (state === 'playing') {
    elapsed  += dt;

    // +1 point per second survived
    scoreAcc += dt;
    while (scoreAcc >= 1) { scoreAcc -= 1; score++; }

    // +10 bonus at every 10-second milestone
    if (elapsed >= nextMilestone) {
      score += 10;
      nextMilestone += 10;
    }

    // Spawn timer
    spawnTimer -= dtMs;
    if (spawnTimer <= 0) {
      spawnCat();
      spawnTimer = spawnInterval();
    }

    // Update each cat
    const pb = playerBox();
    let hit  = false;

    for (let i = cats.length - 1; i >= 0; i--) {
      const cat = cats[i];

      // Animation frame toggle every 350 ms
      cat.frameMs += dtMs;
      if (cat.frameMs > 350) { cat.frameMs = 0; cat.frame ^= 1; }

      if (cat.warn) {
        // Warning phase: cat waits at right edge before entering
        cat.warnMs -= dtMs;
        if (cat.warnMs <= 0) cat.warn = false;
        continue;
      }

      // Move left at constant speed
      cat.x -= 170 * dt;

      // +5 bonus when cat clears the player without a collision
      if (!cat.scored && cat.x + CW < PX) {
        cat.scored = true;
        score += 5;
      }

      // Remove when fully off screen left
      if (cat.x + CW < 0) { cats.splice(i, 1); continue; }

      // Collision check
      if (overlaps(pb, catBox(cat))) { hit = true; break; }
    }

    if (hit) {
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('kd_hi', highScore);
      }
      state = 'gameover';
    }
  }

  // ── DRAW ─────────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, GW, GH);

  if (state === 'start') {
    drawStart();
    requestAnimationFrame(tick);
    return;
  }

  if (state === 'gameover') {
    drawGameOver();
    requestAnimationFrame(tick);
    return;
  }

  // Playing
  drawBG();

  // Draw cats
  for (const cat of cats) {
    if (cat.warn) {
      // Warning: pulsing cat at right edge
      const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 110);
      ctx.globalAlpha = pulse;
      drawCat(GW - CW - 5, cat.y, cat.atFloor, 0);
      ctx.globalAlpha = 1;
      // Exclamation indicator
      ctx.fillStyle = C.tomato;
      ctx.font      = 'bold 13px monospace';
      ctx.textAlign = 'center';
      const ey = cat.atFloor ? cat.y - 10 : cat.y + CH + 18;
      ctx.fillText('!', GW - CW / 2 - 5, ey);
      ctx.textAlign = 'left';
    } else {
      drawCat(cat.x, cat.y, cat.atFloor, cat.frame);
    }
  }

  // Draw player
  drawRat(PX, onFloor ? FLOOR_Y : CEIL_Y, !onFloor);

  drawHUD();

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
