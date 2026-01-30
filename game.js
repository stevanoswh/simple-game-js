(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  const ui = {
    score: document.getElementById("score"),
    time: document.getElementById("time"),
    combo: document.getElementById("combo"),
    coins: document.getElementById("coins"),
    danger: document.getElementById("danger"),
    dash: document.getElementById("dash"),
    best: document.getElementById("best"),
    freeze: document.getElementById("freeze"),
    overlay: document.getElementById("overlay"),
    how: document.getElementById("how"),
    btnStart: document.getElementById("btnStart"),
    btnHow: document.getElementById("btnHow"),
    gameover: document.getElementById("gameover"),
    summary: document.getElementById("summary"),
    btnRestart: document.getElementById("btnRestart"),
    btnClose: document.getElementById("btnClose"),
  };

  const joy = document.getElementById("joy");
  const joyStick = joy.querySelector(".stick");

  const W = canvas.width, H = canvas.height;

  // ===== Helpers =====
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const len = (x, y) => Math.hypot(x, y);
  const norm = (x, y) => {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const rand = (a, b) => a + Math.random() * (b - a);

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // ===== Settings (kids can tweak numbers) =====
  const SETTINGS = {
    playerSpeed: 240,     // TODO A: try 280
    dashCooldown: 1.4,    // TODO B: try 1.0
    coinScore: 25,        // TODO C: try 40
    maxCombo: 4.0,
  };

  // ===== Game state =====
  const state = {
    running: false,
    paused: false,
    t: 0,
    score: 0,
    coinCount: 0,
    danger: 1,
    combo: 1,
    comboTimer: 0,
    shield: 0,
    boost: 0,

    // TODO 0 (kids add these 2 lines if removed):
    freeze: 0,            // freeze timer
    highScore: 0,         // best score

    dashCd: 0,
    dashReady: true,

    particles: [],
    coins: [],
    enemies: [],
    powerups: [],
  };

  const player = {
    x: W / 2,
    y: H / 2,
    r: 12,
    vx: 0,
    vy: 0,
    speed: SETTINGS.playerSpeed,
  };

  // ===== Input =====
  const keys = new Set();
  let joyVec = { x: 0, y: 0 };

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d","shift","p","r"].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === "p" && state.running) state.paused = !state.paused;
    if (k === "r" && state.running) restart();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // Mobile joystick
  let joyActive = false, joyCenter = { x: 0, y: 0 };
  const joyRadius = 44;

  function setJoyStick(dx, dy) {
    joyVec.x = dx;
    joyVec.y = dy;
    joyStick.style.transform = `translate(calc(-50% + ${dx*joyRadius}px), calc(-50% + ${dy*joyRadius}px))`;
  }

  joy.addEventListener("pointerdown", (e) => {
    joyActive = true;
    joy.setPointerCapture(e.pointerId);
    const rect = joy.getBoundingClientRect();
    joyCenter.x = rect.left + rect.width / 2;
    joyCenter.y = rect.top + rect.height / 2;
  });
  joy.addEventListener("pointermove", (e) => {
    if (!joyActive) return;
    const dx = e.clientX - joyCenter.x;
    const dy = e.clientY - joyCenter.y;
    const [nx, ny] = norm(dx, dy);
    const mag = clamp(len(dx, dy) / (joyRadius * 1.2), 0, 1);
    setJoyStick(nx * mag, ny * mag);
  });
  joy.addEventListener("pointerup", () => { joyActive = false; setJoyStick(0, 0); });
  joy.addEventListener("pointercancel", () => { joyActive = false; setJoyStick(0, 0); });

  // ===== Spawners =====
  function spawnCoin() {
    let x, y;

    // TODO 5: coins spawn near edges more often (kids paste block here)
    // (If they skip TODO 5, the game still works.)
    x = rand(30, W - 30);
    y = rand(30, H - 30);

    // keep away from player a bit
    for (let i = 0; i < 12; i++) {
      if (len(x - player.x, y - player.y) > 140) break;
      x = rand(30, W - 30);
      y = rand(30, H - 30);
    }

    state.coins.push({ x, y, r: 8, t: 0 });
  }

  function spawnEnemy() {
    const side = Math.floor(rand(0, 4));
    let x = 0, y = 0;
    if (side === 0) { x = -20; y = rand(0, H); }
    if (side === 1) { x = W + 20; y = rand(0, H); }
    if (side === 2) { x = rand(0, W); y = -20; }
    if (side === 3) { x = rand(0, W); y = H + 20; }

    const typeRoll = Math.random();
    let type = "seeker";
    if (typeRoll < Math.min(0.25, 0.10 + state.t / 120)) type = "dart";

    const baseSpeed = type === "seeker" ? rand(85, 115) : rand(140, 190);
    state.enemies.push({
      x, y,
      r: type === "seeker" ? 14 : 10,
      vx: 0, vy: 0,
      speed: baseSpeed + state.danger * 6,
      type,
      wobble: rand(0, Math.PI * 2),
    });
  }

  function spawnPowerup() {
    // TODO 3a: add "freeze" to list
    const kinds = ["pulse", "shield", "boost", "freeze"];
    const kind = kinds[Math.floor(rand(0, kinds.length))];

    state.powerups.push({
      kind,
      x: rand(40, W - 40),
      y: rand(40, H - 40),
      r: 11,
      t: 0,
    });
  }

  // ===== FX =====
  function burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 240);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.35, 0.8),
        t: 0,
        color
      });
    }
  }

  // ===== Flow =====
  function start() {
    ui.overlay.classList.remove("show");
    restart();
    state.running = true;
    state.paused = false;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function restart() {
    state.t = 0;
    state.score = 0;
    state.coinCount = 0;
    state.danger = 1;
    state.combo = 1;
    state.comboTimer = 0;
    state.shield = 0;
    state.boost = 0;
    state.freeze = 0;

    state.dashCd = 0;
    state.dashReady = true;
    state.particles = [];
    state.coins = [];
    state.enemies = [];
    state.powerups = [];

    player.x = W / 2; player.y = H / 2;
    player.vx = 0; player.vy = 0;
    player.speed = SETTINGS.playerSpeed;

    // TODO 4a: load best score from localStorage
    state.highScore = Number(localStorage.getItem("neon_highscore") || 0);

    for (let i = 0; i < 4; i++) spawnCoin();
    for (let i = 0; i < 2; i++) spawnEnemy();
    spawnPowerup();

    ui.gameover.classList.remove("show");
    ui.best.textContent = state.highScore;
    ui.freeze.textContent = state.freeze.toFixed(1);
  }

  function gameOver() {
    state.running = false;

    // TODO 4b: save best score
    const s = Math.floor(state.score);
    if (s > state.highScore) {
      state.highScore = s;
      localStorage.setItem("neon_highscore", String(s));
    }
    ui.best.textContent = state.highScore;

    ui.gameover.classList.add("show");
    ui.summary.textContent =
      `You survived ${state.t.toFixed(1)}s, collected ${state.coinCount} coins, scored ${Math.floor(state.score)}. Best: ${state.highScore}`;
  }

  // ===== Collision =====
  function hitCircle(a, b) {
    return len(a.x - b.x, a.y - b.y) < (a.r + b.r);
  }

  function tryDash(dirx, diry) {
    if (!state.dashReady) return;
    const [nx, ny] = norm(dirx, diry);
    const dashDist = 120;

    player.x = clamp(player.x + nx * dashDist, player.r, W - player.r);
    player.y = clamp(player.y + ny * dashDist, player.r, H - player.r);

    state.dashReady = false;
    state.dashCd = SETTINGS.dashCooldown;
    burst(player.x, player.y, 16, "rgba(124,167,255,0.9)");
  }

  // ===== Kids add feature (coin gain logic) =====
  function getCoinGain() {
    // TODO 2-3 lines example:
    // return SETTINGS.coinScore + state.danger * 2;
    return SETTINGS.coinScore;
  }

  function update(dt) {
    state.t += dt;

    // difficulty scaling
    state.danger = 1 + Math.floor(state.t / 15);

    // combo decay
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }

    // dash cooldown
    if (!state.dashReady) {
      state.dashCd -= dt;
      if (state.dashCd <= 0) { state.dashReady = true; state.dashCd = 0; }
    }

    // timers
    state.shield = Math.max(0, state.shield - dt);
    state.boost = Math.max(0, state.boost - dt);

    // TODO 3c: freeze timer down
    state.freeze = Math.max(0, state.freeze - dt);

    // UI mini
    ui.danger.textContent = state.danger;
    ui.dash.textContent = state.dashReady ? "Ready" : `${state.dashCd.toFixed(1)}s`;
    ui.freeze.textContent = state.freeze.toFixed(1);

    // input
    let ix = 0, iy = 0;
    if (keys.has("arrowleft") || keys.has("a")) ix -= 1;
    if (keys.has("arrowright") || keys.has("d")) ix += 1;
    if (keys.has("arrowup") || keys.has("w")) iy -= 1;
    if (keys.has("arrowdown") || keys.has("s")) iy += 1;

    ix += joyVec.x;
    iy += joyVec.y;

    const speedMul = state.boost > 0 ? 1.35 : 1.0;
    const targetSpeed = player.speed * speedMul;

    if (keys.has("shift") && (ix !== 0 || iy !== 0)) {
      keys.delete("shift");
      tryDash(ix, iy);
    }

    // smooth movement
    const [nx, ny] = norm(ix, iy);
    const desiredVx = nx * targetSpeed;
    const desiredVy = ny * targetSpeed;
    const smooth = 10;
    player.vx += (desiredVx - player.vx) * (1 - Math.exp(-smooth * dt));
    player.vy += (desiredVy - player.vy) * (1 - Math.exp(-smooth * dt));

    player.x = clamp(player.x + player.vx * dt, player.r, W - player.r);
    player.y = clamp(player.y + player.vy * dt, player.r, H - player.r);

    // enemies
    for (const e of state.enemies) {

      // TODO 3c: if frozen, skip enemy brain + movement
      if (state.freeze > 0) {
        // still can bounce later if you want, but simplest: do nothing
        continue;
      }

      if (e.type === "seeker") {
        const [sx, sy] = norm(player.x - e.x, player.y - e.y);
        e.wobble += dt * 2.2;
        const wx = Math.cos(e.wobble) * 0.20;
        const wy = Math.sin(e.wobble) * 0.20;
        const vx = (sx + wx) * e.speed;
        const vy = (sy + wy) * e.speed;
        e.vx += (vx - e.vx) * (1 - Math.exp(-6 * dt));
        e.vy += (vy - e.vy) * (1 - Math.exp(-6 * dt));
      } else {
        if (!e.locked) {
          const [sx, sy] = norm(player.x - e.x, player.y - e.y);
          e.vx = sx * e.speed * 1.2;
          e.vy = sy * e.speed * 1.2;
          e.locked = true;
        }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // TODO 1: enemy bounce on walls (kids paste here)
      // if (e.x < e.r) { e.x = e.r; e.vx *= -1; }
      // if (e.x > W - e.r) { e.x = W - e.r; e.vx *= -1; }
      // if (e.y < e.r) { e.y = e.r; e.vy *= -1; }
      // if (e.y > H - e.r) { e.y = H - e.r; e.vy *= -1; }
    }

    // spawn controls
    const maxEnemies = clamp(3 + Math.floor(state.t / 10), 3, 12);
    if (state.enemies.length < maxEnemies && Math.random() < (0.6 * dt)) spawnEnemy();
    if (state.coins.length < 5 && Math.random() < (1.2 * dt)) spawnCoin();
    if (state.powerups.length < 1 && Math.random() < (0.08 * dt)) spawnPowerup();

    // particles
    state.particles = state.particles.filter(p => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-4 * dt);
      p.vy *= Math.exp(-4 * dt);
      return p.t < p.life;
    });

    // coins
    for (let i = state.coins.length - 1; i >= 0; i--) {
      const coin = state.coins[i];
      coin.t += dt;

      // TODO 2: coin magnet during boost (kids paste here)
      // if (state.boost > 0) {
      //   const dx = player.x - coin.x;
      //   const dy = player.y - coin.y;
      //   const dist = Math.hypot(dx, dy);
      //   const range = 160;
      //   if (dist < range && dist > 1) {
      //     const pull = 260;
      //     coin.x += (dx / dist) * pull * dt;
      //     coin.y += (dy / dist) * pull * dt;
      //   }
      // }

      if (hitCircle(player, coin)) {
        state.coins.splice(i, 1);
        state.coinCount += 1;

        state.comboTimer = 2.5;
        state.combo = clamp(state.combo + 0.15, 1, SETTINGS.maxCombo);

        const gain = getCoinGain() * state.combo;
        state.score += gain;
        burst(coin.x, coin.y, 10, "rgba(124,255,178,0.9)");
      }
    }

    // powerups
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const pu = state.powerups[i];
      pu.t += dt;
      if (hitCircle(player, pu)) {
        state.powerups.splice(i, 1);

        if (pu.kind === "pulse") {
          for (const e of state.enemies) {
            const [dx, dy] = norm(e.x - player.x, e.y - player.y);
            e.vx += dx * 420;
            e.vy += dy * 420;
          }
          state.score += 80;
          burst(player.x, player.y, 22, "rgba(124,167,255,0.9)");
        } else if (pu.kind === "shield") {
          state.shield = 8.0;
          state.score += 60;
          burst(player.x, player.y, 14, "rgba(255,218,124,0.9)");
        } else if (pu.kind === "boost") {
          state.boost = 6.0;
          state.score += 60;
          burst(player.x, player.y, 14, "rgba(124,255,178,0.7)");
        } else if (pu.kind === "freeze") {
          // TODO 3b: freeze effect
          state.freeze = 3.0;
          state.score += 70;
          burst(player.x, player.y, 18, "rgba(124,167,255,0.9)");
        }
      }
    }

    // enemy collision
    for (const e of state.enemies) {
      if (hitCircle(player, e)) {
        if (state.shield > 0) {
          state.shield = 0;
          const [dx, dy] = norm(e.x - player.x, e.y - player.y);
          e.vx += dx * 650;
          e.vy += dy * 650;
          burst(player.x, player.y, 18, "rgba(255,218,124,0.9)");
          state.score += 30;
        } else {
          burst(player.x, player.y, 26, "rgba(255,92,122,0.95)");
          gameOver();
          return;
        }
      }
    }

    // survival score
    state.score += dt * 8;

    // UI
    ui.score.textContent = Math.floor(state.score);
    ui.time.textContent = state.t.toFixed(1);
    ui.coins.textContent = state.coinCount;
    ui.combo.textContent = "x" + state.combo.toFixed(1);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // grid
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // particles
    for (const p of state.particles) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + 2 * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // coins
    for (const c of state.coins) {
      const pulse = 1 + Math.sin((c.t || 0) * 8) * 0.12;
      ctx.fillStyle = "rgba(124,255,178,0.95)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "rgba(124,255,178,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 1.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // powerups
    for (const p of state.powerups) {
      const t = p.t || 0;
      const bob = Math.sin(t * 4) * 3;

      let col = "rgba(124,167,255,0.95)";
      if (p.kind === "shield") col = "rgba(255,218,124,0.95)";
      if (p.kind === "boost") col = "rgba(124,255,178,0.85)";
      if (p.kind === "freeze") col = "rgba(124,167,255,0.75)";

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, p.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, p.r * 1.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(0,0,0,.35)";
      roundRect(p.x - 7, p.y + bob - 7, 14, 14, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.86)";
      ctx.font = "bold 10px ui-sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = p.kind === "pulse" ? "P" : p.kind === "shield" ? "S" : p.kind === "boost" ? "B" : "F";
      ctx.fillText(icon, p.x, p.y + bob);
    }

    // enemies
    for (const e of state.enemies) {
      ctx.fillStyle = e.type === "seeker" ? "rgba(255,92,122,0.92)" : "rgba(255,92,122,0.70)";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "rgba(255,92,122,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 1.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // player glow
    const glow = state.boost > 0 ? "rgba(124,255,178,0.60)" : "rgba(124,167,255,0.55)";
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // player core
    ctx.fillStyle = state.boost > 0 ? "rgba(124,255,178,0.95)" : "rgba(124,167,255,0.95)";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();

    // shield ring
    if (state.shield > 0) {
      const phase = (state.t * 3) % (Math.PI * 2);
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = "rgba(255,218,124,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r * 1.8 + Math.sin(phase) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // pause text
    if (state.paused && state.running) {
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "bold 40px ui-sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSED", W / 2, H / 2 - 12);
      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.font = "14px ui-sans-serif";
      ctx.fillText("Press P to resume", W / 2, H / 2 + 24);
    }
  }

  let last = performance.now();
  function loop(now) {
    if (!state.running) { draw(); return; }
    const dt = clamp((now - last) / 1000, 0, 0.033);
    last = now;

    if (!state.paused) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // UI buttons
  ui.btnStart.addEventListener("click", start);
  ui.btnHow.addEventListener("click", () => {
    ui.how.style.display = ui.how.style.display === "none" ? "block" : "none";
  });
  ui.btnRestart.addEventListener("click", () => {
    state.running = true;
    state.paused = false;
    restart();
    last = performance.now();
    requestAnimationFrame(loop);
  });
  ui.btnClose.addEventListener("click", () => {
    ui.gameover.classList.remove("show");
    ui.overlay.classList.add("show");
  });
})();
