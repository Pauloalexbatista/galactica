// ============================================================================
// GALACTICA: VIPER STRIKE (Phoenix Arcade Edition - High Difficulty Overhaul)
// ============================================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;   // 600
const HEIGHT = canvas.height; // 750

// Game States
const STATE = {
  TITLE: 'TITLE',
  INTRO_GALACTICA: 'INTRO_GALACTICA',
  INTRO_TUBE: 'INTRO_TUBE',
  INTRO_WARP: 'INTRO_WARP',
  PLAYING: 'PLAYING',
  LEVEL_CLEAR: 'LEVEL_CLEAR',
  GAMEOVER: 'GAMEOVER'
};

let gameState = STATE.TITLE;
let stateTimer = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('galactica_highscore') || '10000', 10);
let lives = 3;
let currentWave = 1;
let lastTime = performance.now();

// Difficulty scaling multipliers
function getWaveMultipliers(wave) {
  return {
    speed: 1 + (wave - 1) * 0.12,
    fireRate: 1 + (wave - 1) * 0.20,
    diveProb: 1 + (wave - 1) * 0.25,
    hpBonus: Math.floor((wave - 1) / 2)
  };
}

// DOM references
const scoreEl = document.getElementById('scoreDisplay');
const highScoreEl = document.getElementById('highScoreDisplay');
const livesContainer = document.getElementById('livesContainer');
const shieldMeterEl = document.getElementById('shieldMeter');

highScoreEl.textContent = highScore.toString().padStart(5, '0');

function updateLivesDisplay() {
  livesContainer.innerHTML = '';
  for (let i = 0; i < lives; i++) {
    const icon = document.createElement('span');
    icon.className = 'viper-life-icon';
    livesContainer.appendChild(icon);
  }
}
updateLivesDisplay();

// Input management (Default Retro Microcomputer: Q A O P SPC X)
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
  shield: false
};

window.addEventListener('keydown', (e) => {
  // Classic QAOP + SPC + X layout
  if (['KeyO', 'ArrowLeft'].includes(e.code)) keys.left = true;
  if (['KeyP', 'ArrowRight'].includes(e.code)) keys.right = true;
  if (['KeyQ', 'ArrowUp', 'KeyW'].includes(e.code)) keys.up = true;
  if (['KeyA', 'ArrowDown', 'KeyS'].includes(e.code)) keys.down = true;

  if (['Space', 'KeyZ'].includes(e.code)) {
    keys.fire = true;
    handleAnyKey(e.code);
    e.preventDefault();
  }
  if (['KeyX', 'KeyE'].includes(e.code)) {
    keys.shield = true;
    e.preventDefault();
  }
  if (e.code === 'KeyM') {
    const isMuted = soundEngine.toggleMute();
    console.log("Audio muted:", isMuted);
  }
});

window.addEventListener('keyup', (e) => {
  if (['KeyO', 'ArrowLeft'].includes(e.code)) keys.left = false;
  if (['KeyP', 'ArrowRight'].includes(e.code)) keys.right = false;
  if (['KeyQ', 'ArrowUp', 'KeyW'].includes(e.code)) keys.up = false;
  if (['KeyA', 'ArrowDown', 'KeyS'].includes(e.code)) keys.down = false;
  if (['Space', 'KeyZ'].includes(e.code)) keys.fire = false;
  if (['KeyX', 'KeyE'].includes(e.code)) keys.shield = false;
});

// Touch buttons
function setupTouchButton(id, keyProp) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const press = (e) => {
    e.preventDefault();
    keys[keyProp] = true;
    handleAnyKey('touch');
  };
  const release = (e) => {
    e.preventDefault();
    keys[keyProp] = false;
  };
  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('mouseleave', release);
}

setupTouchButton('btn-left', 'left');
setupTouchButton('btn-right', 'right');
setupTouchButton('btn-fire', 'fire');
setupTouchButton('btn-shield', 'shield');

canvas.addEventListener('click', () => {
  handleAnyKey('click');
});

function handleAnyKey(code) {
  soundEngine.init();

  if (gameState === STATE.TITLE) {
    startIntro();
  } else if (gameState === STATE.INTRO_GALACTICA || gameState === STATE.INTRO_TUBE || gameState === STATE.INTRO_WARP) {
    startBattle();
  } else if (gameState === STATE.GAMEOVER) {
    resetGame();
  } else if (gameState === STATE.LEVEL_CLEAR) {
    nextWave();
  }
}

// ============================================================================
// Starfield Background & Warp Streaks
// ============================================================================
class Star {
  constructor(warp = false) {
    this.reset(warp);
  }

  reset(warp = false) {
    this.x = Math.random() * WIDTH;
    this.y = Math.random() * HEIGHT;
    this.z = Math.random() * 3 + 1;
    this.size = Math.random() * 1.8 + 0.8;
    this.speed = this.z * 0.75;
    this.brightness = Math.random() * 0.7 + 0.3;
    this.warpX = (this.x - WIDTH / 2);
    this.warpY = (this.y - HEIGHT / 2);
    this.warpZ = Math.random() * WIDTH;
  }

  update(dt, warpSpeed = 1) {
    if (warpSpeed > 2) {
      this.warpZ -= warpSpeed * 8;
      if (this.warpZ <= 0) {
        this.warpZ = WIDTH;
        this.warpX = (Math.random() - 0.5) * WIDTH * 1.5;
        this.warpY = (Math.random() - 0.5) * HEIGHT * 1.5;
      }
    } else {
      this.y += this.speed * warpSpeed;
      if (this.y > HEIGHT) {
        this.y = 0;
        this.x = Math.random() * WIDTH;
      }
    }
  }

  draw(ctx, warpSpeed = 1) {
    if (warpSpeed > 2) {
      const k = 250 / this.warpZ;
      const px = this.warpX * k + WIDTH / 2;
      const py = this.warpY * k + HEIGHT / 2;

      const prevK = 250 / (this.warpZ + warpSpeed * 6);
      const prevX = this.warpX * prevK + WIDTH / 2;
      const prevY = this.warpY * prevK + HEIGHT / 2;

      ctx.strokeStyle = `rgba(180, 230, 255, ${Math.min(1, (1 - this.warpZ / WIDTH) * 1.5)})`;
      ctx.lineWidth = Math.max(1.2, 3 - (this.warpZ / WIDTH) * 2);
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(px, py);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
      ctx.fillRect(this.x, this.y, this.size, this.size);
    }
  }
}

const stars = Array.from({ length: 120 }, () => new Star());

// ============================================================================
// Particle System
// ============================================================================
class Particle {
  constructor(x, y, color, vx, vy, life, size = 3) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
  }

  update(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.life -= dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

let particles = [];

function createExplosion(x, y, count = 25, isBig = false) {
  const colors = isBig 
    ? ['#ff3300', '#ff9900', '#ffff66', '#ffffff', '#00e5ff'] 
    : ['#ff4400', '#ffaa00', '#ffffff'];
  
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * (isBig ? 6 : 3.5) + 0.8;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const life = Math.random() * (isBig ? 0.7 : 0.4) + 0.25;
    const size = Math.random() * (isBig ? 5 : 3) + 1.5;
    particles.push(new Particle(
      x, y, color, 
      Math.cos(angle) * speed, 
      Math.sin(angle) * speed, 
      life, size
    ));
  }
  soundEngine.playExplosion(isBig ? 1.5 : 0.9);
}

// ============================================================================
// Player (Colonial Viper Mk II)
// ============================================================================
class Player {
  constructor() {
    this.width = 34;
    this.height = 42;
    this.x = WIDTH / 2;
    this.y = HEIGHT - 80;
    this.speed = 340;
    this.lastShot = 0;
    this.shotCooldown = 0.17;
    this.weaponLevel = 1;

    // Phoenix Shield
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.shieldDuration = 2.5;
    this.shieldCooldown = 7.0;
    this.shieldCooldownTimer = 0;

    this.invulnerable = false;
    this.respawnTimer = 0;
  }

  reset() {
    this.x = WIDTH / 2;
    this.y = HEIGHT - 80;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.shieldCooldownTimer = 0;
    this.invulnerable = true;
    this.respawnTimer = 2.0;
  }

  update(dt) {
    // Movement (Q = Cima, A = Baixo, O = Esquerda, P = Direita)
    if (keys.left) this.x -= this.speed * dt;
    if (keys.right) this.x += this.speed * dt;
    if (keys.up) this.y -= this.speed * dt * 0.85;
    if (keys.down) this.y += this.speed * dt * 0.85;

    // Boundaries
    const margin = this.width / 2 + 8;
    if (this.x < margin) this.x = margin;
    if (this.x > WIDTH - margin) this.x = WIDTH - margin;

    const minY = HEIGHT - 250;
    const maxY = HEIGHT - 45;
    if (this.y < minY) this.y = minY;
    if (this.y > maxY) this.y = maxY;

    // Firing
    if (keys.fire && performance.now() - this.lastShot > this.shotCooldown * 1000) {
      this.shoot();
      this.lastShot = performance.now();
    }

    // Phoenix Shield activation
    if (keys.shield && !this.shieldActive && this.shieldCooldownTimer <= 0) {
      this.activateShield();
    }

    // Shield active timer
    if (this.shieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        this.shieldCooldownTimer = this.shieldCooldown;
      }
    } else if (this.shieldCooldownTimer > 0) {
      this.shieldCooldownTimer -= dt;
      if (this.shieldCooldownTimer < 0) this.shieldCooldownTimer = 0;
    }

    // Update Shield HUD Meter
    if (this.shieldActive) {
      const pct = (this.shieldTimer / this.shieldDuration) * 100;
      shieldMeterEl.style.width = pct + '%';
      shieldMeterEl.classList.remove('cooling-down');
    } else if (this.shieldCooldownTimer > 0) {
      const pct = (1 - (this.shieldCooldownTimer / this.shieldCooldown)) * 100;
      shieldMeterEl.style.width = pct + '%';
      shieldMeterEl.classList.add('cooling-down');
    } else {
      shieldMeterEl.style.width = '100%';
      shieldMeterEl.classList.remove('cooling-down');
    }

    // Respawn invulnerability
    if (this.invulnerable) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.invulnerable = false;
    }

    // Thruster engine particles
    if (Math.random() < 0.85) {
      particles.push(new Particle(
        this.x + (Math.random() - 0.5) * 8,
        this.y + 20,
        Math.random() < 0.6 ? '#00e5ff' : '#ff9900',
        (Math.random() - 0.5) * 0.8,
        Math.random() * 2 + 3.5,
        0.25,
        2.5
      ));
    }
  }

  activateShield() {
    this.shieldActive = true;
    this.shieldTimer = this.shieldDuration;
    soundEngine.playShield();
  }

  shoot() {
    soundEngine.playLaser();
    if (this.weaponLevel === 1) {
      playerLasers.push(new Laser(this.x - 12, this.y - 12, -780, '#ff3344'));
      playerLasers.push(new Laser(this.x + 12, this.y - 12, -780, '#ff3344'));
    } else if (this.weaponLevel === 2) {
      playerLasers.push(new Laser(this.x - 14, this.y - 10, -780, '#00e5ff'));
      playerLasers.push(new Laser(this.x, this.y - 20, -820, '#ffffff'));
      playerLasers.push(new Laser(this.x + 14, this.y - 10, -780, '#00e5ff'));
    } else {
      playerLasers.push(new Laser(this.x - 16, this.y - 10, -780, '#ffdd00', -120));
      playerLasers.push(new Laser(this.x - 6, this.y - 18, -820, '#00e5ff'));
      playerLasers.push(new Laser(this.x + 6, this.y - 18, -820, '#00e5ff'));
      playerLasers.push(new Laser(this.x + 16, this.y - 10, -780, '#ffdd00', 120));
    }
  }

  draw(ctx) {
    if (this.invulnerable && Math.floor(performance.now() / 80) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // Fuselage
    ctx.fillStyle = '#f2f4f8';
    ctx.strokeStyle = '#c5d0dc';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(8, 2);
    ctx.lineTo(8, 16);
    ctx.lineTo(-8, 16);
    ctx.lineTo(-8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red colonial stripe on nose
    ctx.fillStyle = '#c52828';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(4, -10);
    ctx.lineTo(-4, -10);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.fillStyle = '#e4e8f0';
    ctx.beginPath();
    ctx.moveTo(-8, 5);
    ctx.lineTo(-18, 16);
    ctx.lineTo(-18, 18);
    ctx.lineTo(-8, 14);
    ctx.moveTo(8, 5);
    ctx.lineTo(18, 16);
    ctx.lineTo(18, 18);
    ctx.lineTo(8, 14);
    ctx.fill();
    ctx.stroke();

    // Wingtips & Laser Cannons
    ctx.fillStyle = '#ff2222';
    ctx.fillRect(-18, 6, 2.5, 12);
    ctx.fillRect(15.5, 6, 2.5, 12);

    // Vertical fin
    ctx.fillStyle = '#cf3232';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(3, 14);
    ctx.lineTo(-3, 14);
    ctx.closePath();
    ctx.fill();

    // Canopy
    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.ellipse(0, -3, 3.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Engines
    ctx.fillStyle = '#333e50';
    ctx.fillRect(-7, 16, 5, 4);
    ctx.fillRect(2, 16, 5, 4);
    ctx.fillRect(-2.5, 15, 5, 5);

    // Phoenix Energy Shield
    if (this.shieldActive) {
      const pulse = Math.sin(performance.now() * 0.015) * 3;
      const radius = 34 + pulse;

      const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, radius + 8);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.1)');
      grad.addColorStop(0.7, 'rgba(0, 229, 255, 0.45)');
      grad.addColorStop(1, 'rgba(0, 255, 200, 0.9)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#a6faff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ============================================================================
// Lasers & Plasma Projectiles
// ============================================================================
class Laser {
  constructor(x, y, vy, color = '#ff3344', vx = 0, isHeavy = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.isHeavy = isHeavy;
    this.width = isHeavy ? 6 : 3.5;
    this.height = isHeavy ? 20 : 14;
    this.active = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -25 || this.y > HEIGHT + 25 || this.x < -25 || this.x > WIDTH + 25) {
      this.active = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.isHeavy ? 12 : 8;
    if (this.isHeavy) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
    }
    ctx.restore();
  }
}

let playerLasers = [];
let enemyLasers = [];

// ============================================================================
// Power-Ups
// ============================================================================
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'WEAPON' | 'SHIELD' | 'LIFE'
    this.vy = 90;
    this.active = true;
    this.radius = 12;
  }

  update(dt) {
    this.y += this.vy * dt;
    if (this.y > HEIGHT + 20) this.active = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const pulse = Math.sin(performance.now() * 0.01) * 2;

    ctx.fillStyle = this.type === 'WEAPON' ? '#00e5ff' : (this.type === 'SHIELD' ? '#ffaa00' : '#ff0055');
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = '9px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const char = this.type === 'WEAPON' ? 'W' : (this.type === 'SHIELD' ? 'S' : '+');
    ctx.fillText(char, 0, 1);
    ctx.restore();
  }
}

let powerups = [];

// ============================================================================
// Extended Enemy Roster & Enhanced AI
// ============================================================================
class Enemy {
  constructor(x, y, type = 'RAIDER', wave = 1) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.type = type; // 'RAIDER' | 'SCAR_ACE' | 'PHOENIX_BIRD' | 'GUNSHIP' | 'BASESTAR'
    this.wave = wave;
    this.active = true;

    const mult = getWaveMultipliers(wave);

    this.timeOffset = Math.random() * Math.PI * 2;
    this.state = 'FORMATION'; // 'FORMATION', 'DIVING', 'RETURNING'
    this.diveSpeed = (170 + Math.random() * 80) * mult.speed;
    this.diveCurve = (Math.random() - 0.5) * 220;
    this.hitFlash = 0; // Flash red/white when struck

    if (this.type === 'RAIDER') {
      this.width = 32;
      this.height = 24;
      this.hp = 3 + mult.hpBonus; // Durabilidade reforçada! (3-5 tiros)
      this.maxHp = this.hp;
      this.scoreVal = 150;
    } else if (this.type === 'SCAR_ACE') {
      this.width = 36;
      this.height = 28;
      this.hp = 6 + mult.hpBonus * 2; // Ás de combate (6-10 tiros)
      this.maxHp = this.hp;
      this.scoreVal = 400;
      this.diveSpeed *= 1.25; // Muito mais rápido
    } else if (this.type === 'PHOENIX_BIRD') {
      this.width = 46;
      this.height = 38;
      this.hp = 10 + mult.hpBonus * 2; // Ave de fogo resistente
      this.maxHp = this.hp;
      this.scoreVal = 750;
      this.leftWing = true;
      this.rightWing = true;
      this.wingHpLeft = 3;
      this.wingHpRight = 3;
    } else if (this.type === 'GUNSHIP') {
      this.width = 54;
      this.height = 42;
      this.hp = 16 + mult.hpBonus * 3; // Tanque blindado pesado
      this.maxHp = this.hp;
      this.scoreVal = 1000;
      this.diveSpeed *= 0.7; // Mais pesado
    } else if (this.type === 'BASESTAR') {
      this.width = 200;
      this.height = 96;
      this.hp = 60 + (wave - 1) * 20; // Chefe colossal
      this.maxHp = this.hp;
      this.scoreVal = 6000;
      const shieldCap = 15 + (wave - 1) * 4;
      this.shieldShields = [shieldCap, shieldCap, shieldCap];
      this.maxShield = shieldCap;
      this.spawnTimer = 0;
    }
  }

  takeDamage(amount = 1) {
    this.hp -= amount;
    this.hitFlash = 0.12; // 120ms flash on hit
    soundEngine.playHitArmor();
    return this.hp <= 0;
  }

  update(dt, globalTime) {
    if (this.hitFlash > 0) this.hitFlash -= dt;

    if (this.type === 'BASESTAR') {
      this.updateBaseStar(dt, globalTime);
      return;
    }

    const mult = getWaveMultipliers(this.wave);

    // Damage smoke particles if heavily wounded
    if (this.hp <= this.maxHp * 0.4 && Math.random() < 0.25) {
      particles.push(new Particle(
        this.x + (Math.random() - 0.5) * 12,
        this.y,
        Math.random() < 0.5 ? '#555555' : '#ff5500',
        (Math.random() - 0.5) * 1.5,
        Math.random() * 2 + 1,
        0.35, 3
      ));
    }

    if (this.state === 'FORMATION') {
      // Sinusoidal formation hovering
      this.x = this.startX + Math.sin(globalTime * 1.8 + this.timeOffset) * 45;
      this.y = this.startY + Math.cos(globalTime * 2.2 + this.timeOffset) * 14;

      // Aggressive dive chance
      const baseDiveChance = (this.type === 'SCAR_ACE' ? 0.0035 : 0.0022) * mult.diveProb;
      if (Math.random() < baseDiveChance) {
        this.state = 'DIVING';
        this.diveAngle = 0;
      }
    } else if (this.state === 'DIVING') {
      this.diveAngle += dt * 3.8;
      this.y += this.diveSpeed * dt;

      if (this.type === 'SCAR_ACE') {
        // Spiral corkscrew dive
        this.x += Math.sin(this.diveAngle * 2) * this.diveCurve * 1.4 * dt;
      } else {
        this.x += Math.sin(this.diveAngle) * this.diveCurve * dt;
      }

      // Attack firing during dive
      const fireChance = 0.035 * mult.fireRate;
      if (Math.random() < fireChance) {
        this.shoot();
      }

      // Screen loop around
      if (this.y > HEIGHT + 40) {
        this.y = -35;
        this.state = 'FORMATION';
      }
    }

    // Occasional long-range formation fire
    if (this.state === 'FORMATION' && Math.random() < 0.0012 * mult.fireRate) {
      this.shoot();
    }
  }

  shoot() {
    if (this.type === 'RAIDER') {
      // Dual fast red lasers
      enemyLasers.push(new Laser(this.x - 6, this.y + 12, 380, '#ff1a40'));
      enemyLasers.push(new Laser(this.x + 6, this.y + 12, 380, '#ff1a40'));
      soundEngine.playEnemyLaser();
    } else if (this.type === 'SCAR_ACE') {
      // Targeted 3-way spread lasers angled towards player
      const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
      const vx = Math.cos(angleToPlayer) * 360;
      enemyLasers.push(new Laser(this.x, this.y + 14, 400, '#ffaa00', vx * 0.6));
      enemyLasers.push(new Laser(this.x - 10, this.y + 10, 390, '#ff3300', vx * 0.4 - 80));
      enemyLasers.push(new Laser(this.x + 10, this.y + 10, 390, '#ff3300', vx * 0.4 + 80));
      soundEngine.playHeavyLaser();
    } else if (this.type === 'PHOENIX_BIRD') {
      // Heavy incendiary plasma bombs
      enemyLasers.push(new Laser(this.x - 14, this.y + 16, 330, '#ff6600', -40, true));
      enemyLasers.push(new Laser(this.x + 14, this.y + 16, 330, '#ff6600', 40, true));
      soundEngine.playHeavyLaser();
    } else if (this.type === 'GUNSHIP') {
      // Heavy flak blast
      enemyLasers.push(new Laser(this.x, this.y + 20, 320, '#ff00aa', 0, true));
      enemyLasers.push(new Laser(this.x - 16, this.y + 16, 320, '#ff00aa', -60, true));
      enemyLasers.push(new Laser(this.x + 16, this.y + 16, 320, '#ff00aa', 60, true));
      soundEngine.playHeavyLaser();
    }
  }

  updateBaseStar(dt, globalTime) {
    if (this.y < 120) {
      this.y += dt * 30;
    } else {
      this.x = WIDTH / 2 + Math.sin(globalTime * 0.7) * 140;
    }

    const mult = getWaveMultipliers(this.wave);

    // Continuous flak barrages
    if (Math.random() < 0.06 * mult.fireRate) {
      const offsetX = (Math.random() - 0.5) * 140;
      enemyLasers.push(new Laser(this.x + offsetX, this.y + 35, 340, '#ff0055', (Math.random() - 0.5) * 80, true));
      soundEngine.playHeavyLaser();
    }

    // Call reinforcements when damaged
    this.spawnTimer += dt;
    if (this.hp < this.maxHp * 0.6 && this.spawnTimer > 7.0) {
      this.spawnTimer = 0;
      // Spawn two escort raiders
      enemies.push(new Enemy(this.x - 60, this.y + 20, 'RAIDER', this.wave));
      enemies.push(new Enemy(this.x + 60, this.y + 20, 'RAIDER', this.wave));
      soundEngine.playCylonPing();
    }
  }

  draw(ctx, globalTime) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Hit flash overlay
    if (this.hitFlash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15;
    }

    if (this.type === 'RAIDER') {
      this.drawCylonRaider(ctx, globalTime);
    } else if (this.type === 'SCAR_ACE') {
      this.drawScarAce(ctx, globalTime);
    } else if (this.type === 'PHOENIX_BIRD') {
      this.drawPhoenixBird(ctx, globalTime);
    } else if (this.type === 'GUNSHIP') {
      this.drawGunship(ctx, globalTime);
    } else if (this.type === 'BASESTAR') {
      this.drawCylonBaseStar(ctx, globalTime);
    }

    // Draw Mini Health Bar for Elite/Heavy units
    if (this.maxHp > 3 && this.type !== 'BASESTAR' && this.hp < this.maxHp) {
      const barW = this.width;
      const barH = 3;
      const pct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = '#111';
      ctx.fillRect(-barW / 2, -this.height / 2 - 8, barW, barH);
      ctx.fillStyle = pct > 0.5 ? '#00e5ff' : (pct > 0.25 ? '#ffaa00' : '#ff2255');
      ctx.fillRect(-barW / 2, -this.height / 2 - 8, barW * pct, barH);
    }

    ctx.restore();
  }

  drawCylonRaider(ctx, globalTime) {
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#6e7a88';
    ctx.strokeStyle = '#394450';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.quadraticCurveTo(16, -5, 17, 13);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 9);
    ctx.lineTo(-17, 13);
    ctx.quadraticCurveTo(-16, -5, 0, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Visor scanner
    const scanOffset = Math.sin(globalTime * 8 + this.timeOffset) * 6;
    ctx.fillStyle = '#ff0022';
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur = 6;
    ctx.fillRect(scanOffset - 2, 0, 4, 3);
  }

  drawScarAce(ctx, globalTime) {
    // Scar Cylon Ace: dark obsidian hull with battle scars and golden trim
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#222831';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(19, 12);
    ctx.lineTo(9, 8);
    ctx.lineTo(0, 14);
    ctx.lineTo(-9, 8);
    ctx.lineTo(-19, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Battle scar slash across hull
    ctx.strokeStyle = '#ff3344';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-7, -4);
    ctx.lineTo(5, 6);
    ctx.stroke();

    // Fast dual scanner eye
    const scanOffset = Math.sin(globalTime * 12 + this.timeOffset) * 7;
    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.fillRect(scanOffset - 2.5, 0, 5, 3);
  }

  drawPhoenixBird(ctx, globalTime) {
    const wingFlap = Math.sin(globalTime * 6.5 + this.timeOffset) * 7;

    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#ff5500';
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 1.5;

    // Head / Crown
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.lineTo(7, -9);
    ctx.lineTo(-7, -9);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = '#b31b00';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Left Wing
    if (this.leftWing) {
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(-25, -13 + wingFlap);
      ctx.lineTo(-21, 11 + wingFlap);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Right Wing
    if (this.rightWing) {
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.moveTo(7, -4);
      ctx.lineTo(25, -13 + wingFlap);
      ctx.lineTo(21, 11 + wingFlap);
      ctx.lineTo(7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Pulsing Core
    ctx.fillStyle = '#ffff33';
    ctx.beginPath();
    ctx.arc(0, 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGunship(ctx, globalTime) {
    // Massive armored gunship
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#333f4d';
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(25, -6);
    ctx.lineTo(25, 16);
    ctx.lineTo(12, 20);
    ctx.lineTo(-12, 20);
    ctx.lineTo(-25, 16);
    ctx.lineTo(-25, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dual Turrets
    ctx.fillStyle = '#1c242e';
    ctx.fillRect(-18, 2, 8, 14);
    ctx.fillRect(10, 2, 8, 14);

    // Glowing core reactor
    const pulse = Math.sin(globalTime * 8) * 2;
    ctx.fillStyle = '#ff00aa';
    ctx.shadowColor = '#ff00aa';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 6 + pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCylonBaseStar(ctx, globalTime) {
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#222b38';
    ctx.strokeStyle = '#4e5e74';
    ctx.lineWidth = 2;

    const rot = Math.sin(globalTime * 0.5) * 0.05;
    ctx.rotate(rot);

    // 5-point star hull structure
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const x1 = Math.cos(angle) * 85;
      const y1 = Math.sin(angle) * 40;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 * 0.6, y1 * 0.6 + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Shield barrier rings
    for (let s = 0; s < 3; s++) {
      const shieldHp = this.shieldShields[s];
      if (shieldHp > 0) {
        ctx.strokeStyle = `rgba(0, 229, 255, ${shieldHp / this.maxShield})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, 34 + s * 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Central core
    ctx.fillStyle = '#0f151e';
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff3344';
    ctx.stroke();

    const brainPulse = Math.sin(globalTime * 6) * 3;
    ctx.fillStyle = '#ff0033';
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(0, 0, 11 + brainPulse, 0, Math.PI * 2);
    ctx.fill();

    // Health Bar
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#222';
    ctx.fillRect(-70, -60, 140, 9);
    ctx.fillStyle = '#ff2255';
    ctx.fillRect(-70, -60, Math.max(0, (this.hp / this.maxHp) * 140), 9);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-70, -60, 140, 9);
  }
}

let enemies = [];
let player = new Player();

// ============================================================================
// Wave Generation & Progressive Escalation
// ============================================================================
function setupWave(waveNumber) {
  enemies = [];
  enemyLasers = [];
  playerLasers = [];
  powerups = [];

  const stageInCycle = ((waveNumber - 1) % 4) + 1;

  if (stageInCycle === 1) {
    // Wave 1: Cylon Raiders + Scar Aces
    const rows = 3;
    const cols = 6;
    const spacingX = 65;
    const spacingY = 48;
    const startX = (WIDTH - (cols - 1) * spacingX) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = (r === 0 && (c === 2 || c === 3)) ? 'SCAR_ACE' : 'RAIDER';
        enemies.push(new Enemy(startX + c * spacingX, 90 + r * spacingY, type, waveNumber));
      }
    }
  } else if (stageInCycle === 2) {
    // Wave 2: Phoenix Firebirds + Cylon Gunships
    const cols = 4;
    const spacingX = 95;
    const startX = (WIDTH - (cols - 1) * spacingX) / 2;

    // Front line: Firebirds
    for (let c = 0; c < cols; c++) {
      enemies.push(new Enemy(startX + c * spacingX, 110, 'PHOENIX_BIRD', waveNumber));
    }
    // Rear line: Armored Gunships
    enemies.push(new Enemy(startX + 0.5 * spacingX, 180, 'GUNSHIP', waveNumber));
    enemies.push(new Enemy(startX + 2.5 * spacingX, 180, 'GUNSHIP', waveNumber));
  } else if (stageInCycle === 3) {
    // Wave 3: Total War Enxame Misto (Raiders, Scar Aces, Gunships, Birds)
    const cols = 5;
    const spacingX = 80;
    const startX = (WIDTH - (cols - 1) * spacingX) / 2;

    for (let c = 0; c < cols; c++) {
      enemies.push(new Enemy(startX + c * spacingX, 85, (c % 2 === 0 ? 'SCAR_ACE' : 'GUNSHIP'), waveNumber));
      enemies.push(new Enemy(startX + c * spacingX, 145, (c % 2 === 0 ? 'PHOENIX_BIRD' : 'RAIDER'), waveNumber));
    }
  } else if (stageInCycle === 4) {
    // Wave 4: Boss Fight - The Cylon BaseStar Flagship!
    enemies.push(new Enemy(WIDTH / 2, -100, 'BASESTAR', waveNumber));
    // Escort wings
    enemies.push(new Enemy(80, 200, 'SCAR_ACE', waveNumber));
    enemies.push(new Enemy(WIDTH - 80, 200, 'SCAR_ACE', waveNumber));
  }
}

// ============================================================================
// Game Transitions & State Management
// ============================================================================
function startIntro() {
  gameState = STATE.INTRO_GALACTICA;
  stateTimer = 0;
  soundEngine.playCylonPing();
}

function startBattle() {
  gameState = STATE.PLAYING;
  setupWave(currentWave);
  soundEngine.startArcadeBGM();
}

function nextWave() {
  currentWave++;
  setupWave(currentWave);
  gameState = STATE.PLAYING;
}

function resetGame() {
  score = 0;
  scoreEl.textContent = '00000';
  lives = 3;
  updateLivesDisplay();
  currentWave = 1;
  player.reset();
  player.weaponLevel = 1;
  startIntro();
}

// ============================================================================
// Cinematic Sequences
// ============================================================================
function drawCinematicGalactica(ctx, timer) {
  stars.forEach(s => {
    s.update(0.016, 0.4);
    s.draw(ctx, 0.4);
  });

  const scale = Math.min(1.0, 0.7 + timer * 0.1);
  ctx.save();
  ctx.translate(WIDTH / 2, 280);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#1c2635';
  ctx.strokeStyle = '#475c75';
  ctx.lineWidth = 2;

  // Front Alligator Head
  ctx.beginPath();
  ctx.moveTo(0, -180);
  ctx.lineTo(55, -110);
  ctx.lineTo(40, -40);
  ctx.lineTo(-40, -40);
  ctx.lineTo(-55, -110);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Midsection spine
  ctx.fillStyle = '#151e2b';
  ctx.fillRect(-28, -40, 56, 120);

  // Flight Pods
  ctx.fillStyle = '#1e2938';
  ctx.strokeStyle = '#475c75';
  ctx.beginPath();
  ctx.roundRect(-140, -20, 60, 140, [10]);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(80, -20, 60, 140, [10]);
  ctx.fill();
  ctx.stroke();

  // Engines
  ctx.fillStyle = '#111722';
  ctx.fillRect(-45, 80, 90, 45);
  const glow = Math.sin(timer * 6) * 0.2 + 0.8;
  ctx.fillStyle = `rgba(0, 210, 255, ${glow * 0.7})`;
  ctx.shadowColor = '#00d2ff';
  ctx.shadowBlur = 15;
  ctx.fillRect(-35, 120, 20, 10);
  ctx.fillRect(15, 120, 20, 10);
  ctx.shadowBlur = 0;

  ctx.restore();

  // Text
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff9900';
  ctx.font = '10px "Orbitron"';
  ctx.fillText("BATTLESTAR GALACTICA // SECTOR 12", WIDTH / 2, 80);

  ctx.fillStyle = '#00e5ff';
  ctx.font = '14px "Press Start 2P"';
  ctx.fillText("ALERTA CYLON DETETADO", WIDTH / 2, 540);

  ctx.fillStyle = '#ffffff';
  ctx.font = '9px "Press Start 2P"';
  ctx.fillText("A PREPARAR CAÇA VIPER...", WIDTH / 2, 575);

  ctx.fillStyle = '#78909c';
  ctx.font = '8px "Press Start 2P"';
  ctx.fillText("[ESPAÇO OU TOQUE PARA AVANÇAR]", WIDTH / 2, 680);

  if (timer > 3.2) {
    gameState = STATE.INTRO_TUBE;
    stateTimer = 0;
    soundEngine.playLaunchTubeRumble();
  }
}

function drawCinematicTube(ctx, timer) {
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const tubeSpeed = Math.min(25, timer * 15 + 4);
  const ringCount = 10;

  for (let i = 0; i < ringCount; i++) {
    const progress = ((timer * tubeSpeed + i * 40) % 300) / 300;
    const ringW = 40 + progress * 560;
    const ringH = 50 + progress * 700;
    const x = (WIDTH - ringW) / 2;
    const y = (HEIGHT - ringH) / 2;

    ctx.strokeStyle = `rgba(0, 210, 255, ${progress * 0.8})`;
    ctx.lineWidth = 1 + progress * 6;
    ctx.strokeRect(x, y, ringW, ringH);
  }

  player.x = WIDTH / 2;
  player.y = HEIGHT / 2 + 120 - timer * 18;
  player.draw(ctx);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffcc';
  ctx.font = '11px "Orbitron"';
  ctx.fillText("COLONIAL LAUNCH TUBE #01", WIDTH / 2, 100);

  let statusText = timer > 1.6 ? "TURBO BOOST ENGAGED!!" : (timer > 0.8 ? "READY FOR LAUNCH..." : "PRESSURIZING...");
  let statusColor = timer > 1.6 ? "#00ff66" : "#ffea00";

  ctx.fillStyle = statusColor;
  ctx.font = '14px "Press Start 2P"';
  ctx.fillText(statusText, WIDTH / 2, 140);

  if (timer > 2.8) {
    gameState = STATE.INTRO_WARP;
    stateTimer = 0;
    soundEngine.playWarpSpeed();
  }
}

function drawCinematicWarp(ctx, timer) {
  ctx.fillStyle = 'rgba(0, 3, 10, 0.45)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  let warpFactor = timer < 1.0 ? 5 + timer * 25 : (timer < 2.2 ? 30 : Math.max(1.5, 30 - (timer - 2.2) * 35));

  stars.forEach(s => {
    s.update(0.016, warpFactor);
    s.draw(ctx, warpFactor);
  });

  player.x = WIDTH / 2;
  player.y = HEIGHT - 180 + Math.sin(timer * 8) * 4;
  player.draw(ctx);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf4ff';
  ctx.font = '15px "Orbitron"';
  ctx.shadowColor = '#00d2ff';
  ctx.shadowBlur = 10;
  ctx.fillText("FTL HYPERSPACE JUMP", WIDTH / 2, 120);

  ctx.font = '11px "Press Start 2P"';
  ctx.fillStyle = '#00e5ff';
  ctx.fillText("A ENTRAR NO CAMPO DE BATALHA...", WIDTH / 2, 160);
  ctx.shadowBlur = 0;

  if (timer > 3.0) {
    startBattle();
  }
}

// ============================================================================
// Collisions & Gameplay Loop
// ============================================================================
function checkCollisions() {
  // 1. Player Lasers vs Enemies
  for (let l of playerLasers) {
    if (!l.active) continue;

    for (let e of enemies) {
      if (!e.active) continue;

      if (e.type === 'BASESTAR') {
        // BaseStar Outer Shields
        let hitShield = false;
        for (let s = 0; s < 3; s++) {
          if (e.shieldShields[s] > 0) {
            const shieldDist = 34 + s * 15;
            const dist = Math.hypot(l.x - e.x, l.y - e.y);
            if (dist < shieldDist + 7 && dist > shieldDist - 7) {
              e.shieldShields[s]--;
              l.active = false;
              createExplosion(l.x, l.y, 8);
              soundEngine.playHitArmor();
              hitShield = true;
              break;
            }
          }
        }
        if (hitShield) break;

        // BaseStar Core
        const distToCore = Math.hypot(l.x - e.x, l.y - e.y);
        if (distToCore < 28) {
          l.active = false;
          const dead = e.takeDamage(1);
          createExplosion(l.x, l.y, 10);
          score += 50;
          if (dead) {
            e.active = false;
            createExplosion(e.x, e.y, 70, true);
            score += e.scoreVal;
            checkLevelClear();
          }
          break;
        }
      } else {
        // Normal / Elite / Gunship / Bird
        if (
          l.x > e.x - e.width / 2 &&
          l.x < e.x + e.width / 2 &&
          l.y > e.y - e.height / 2 &&
          l.y < e.y + e.height / 2
        ) {
          l.active = false;

          // Wing damage for Phoenix Bird
          if (e.type === 'PHOENIX_BIRD') {
            if (l.x < e.x - 7 && e.leftWing) {
              e.wingHpLeft--;
              if (e.wingHpLeft <= 0) e.leftWing = false;
            }
            if (l.x > e.x + 7 && e.rightWing) {
              e.wingHpRight--;
              if (e.wingHpRight <= 0) e.rightWing = false;
            }
          }

          const dead = e.takeDamage(1);
          createExplosion(l.x, l.y, 8);

          if (dead) {
            e.active = false;
            createExplosion(e.x, e.y, 30, e.type !== 'RAIDER');
            score += e.scoreVal;

            // Chance to drop power-up
            if (Math.random() < 0.22) {
              const types = ['WEAPON', 'SHIELD', 'LIFE'];
              const type = types[Math.floor(Math.random() * types.length)];
              powerups.push(new PowerUp(e.x, e.y, type));
            }

            checkLevelClear();
          }
          break;
        }
      }
    }
  }

  // 2. Enemy Lasers vs Player
  for (let l of enemyLasers) {
    if (!l.active) continue;

    const hitDist = Math.hypot(l.x - player.x, l.y - player.y);
    if (hitDist < 18) {
      l.active = false;
      if (player.shieldActive) {
        createExplosion(l.x, l.y, 8);
        soundEngine.playShield();
      } else if (!player.invulnerable) {
        killPlayer();
      }
    }
  }

  // 3. Enemies colliding with Player (Kamikaze ramming)
  for (let e of enemies) {
    if (!e.active) continue;

    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    if (dist < (e.width / 2 + player.width / 2)) {
      if (player.shieldActive) {
        e.active = false;
        createExplosion(e.x, e.y, 30, true);
        score += e.scoreVal;
        checkLevelClear();
      } else if (!player.invulnerable) {
        killPlayer();
      }
    }
  }

  // 4. Power-ups vs Player
  for (let p of powerups) {
    if (!p.active) continue;
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    if (dist < p.radius + 18) {
      p.active = false;
      soundEngine.playPowerup();
      if (p.type === 'WEAPON') {
        player.weaponLevel = Math.min(3, player.weaponLevel + 1);
        score += 250;
      } else if (p.type === 'SHIELD') {
        player.shieldCooldownTimer = 0;
        score += 250;
      } else if (p.type === 'LIFE') {
        lives++;
        updateLivesDisplay();
        score += 500;
      }
    }
  }
}

function checkLevelClear() {
  const remaining = enemies.filter(e => e.active).length;
  if (remaining === 0) {
    gameState = STATE.LEVEL_CLEAR;
    stateTimer = 0;
    soundEngine.playPowerup();
  }
}

function killPlayer() {
  createExplosion(player.x, player.y, 45, true);
  lives--;
  updateLivesDisplay();

  if (lives <= 0) {
    gameState = STATE.GAMEOVER;
    stateTimer = 0;
    soundEngine.stopArcadeBGM();
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('galactica_highscore', highScore.toString());
      highScoreEl.textContent = highScore.toString().padStart(5, '0');
    }
  } else {
    player.reset();
  }
}

// ============================================================================
// Main Update & Render
// ============================================================================
function update(dt) {
  stateTimer += dt;
  const globalTime = performance.now() / 1000;

  stars.forEach(s => s.update(dt, 1));

  particles = particles.filter(p => {
    p.update(dt);
    return p.life > 0;
  });

  if (gameState === STATE.PLAYING) {
    player.update(dt);

    playerLasers = playerLasers.filter(l => {
      l.update(dt);
      return l.active;
    });

    enemyLasers = enemyLasers.filter(l => {
      l.update(dt);
      return l.active;
    });

    powerups = powerups.filter(p => {
      p.update(dt);
      return p.active;
    });

    enemies.forEach(e => {
      if (e.active) e.update(dt, globalTime);
    });

    checkCollisions();

    scoreEl.textContent = score.toString().padStart(5, '0');
  }
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const globalTime = performance.now() / 1000;

  if (gameState === STATE.TITLE) {
    stars.forEach(s => s.draw(ctx, 1));
    ctx.textAlign = 'center';

    ctx.fillStyle = '#ff9900';
    ctx.font = '10px "Orbitron"';
    ctx.fillText("BATTLESTAR TRIBUTE // 1980 PHOENIX ARCADE", WIDTH / 2, 130);

    ctx.fillStyle = '#ffffff';
    ctx.font = '28px "Orbitron"';
    ctx.shadowColor = '#00d2ff';
    ctx.shadowBlur = 18;
    ctx.fillText("GALACTICA", WIDTH / 2, 185);

    ctx.fillStyle = '#00e5ff';
    ctx.font = '18px "Press Start 2P"';
    ctx.fillText("VIPER STRIKE", WIDTH / 2, 225);
    ctx.shadowBlur = 0;

    player.x = WIDTH / 2;
    player.y = 310;
    player.draw(ctx);

    ctx.fillStyle = '#8faec9';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText("- AMEAÇAS CYLON REFORÇADAS -", WIDTH / 2, 395);
    ctx.fillText("ONDA 1: SCOUT RAIDERS & SCAR ACES", WIDTH / 2, 425);
    ctx.fillText("ONDA 2: PHOENIX BIRDS & GUNSHIPS", WIDTH / 2, 455);
    ctx.fillText("ONDA 3: ENXAME TOTAL DE COMBATE", WIDTH / 2, 485);
    ctx.fillText("ONDA 4: CYLON BASESTAR FLAGSHIP BOSS", WIDTH / 2, 515);

    if (Math.floor(globalTime * 2) % 2 === 0) {
      ctx.fillStyle = '#00ffcc';
      ctx.font = '11px "Press Start 2P"';
      ctx.fillText("PRESSIONE ESPAÇO PARA INICIAR", WIDTH / 2, 590);
    }

    ctx.fillStyle = '#617d98';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText("CONTROLOS: [O/P] Esq/Dir [Q/A] Cima/Baixo [SPC] Tiro [X] Escudo", WIDTH / 2, 690);

  } else if (gameState === STATE.INTRO_GALACTICA) {
    drawCinematicGalactica(ctx, stateTimer);

  } else if (gameState === STATE.INTRO_TUBE) {
    drawCinematicTube(ctx, stateTimer);

  } else if (gameState === STATE.INTRO_WARP) {
    drawCinematicWarp(ctx, stateTimer);

  } else if (gameState === STATE.PLAYING) {
    stars.forEach(s => s.draw(ctx, 1));
    powerups.forEach(p => p.draw(ctx));
    playerLasers.forEach(l => l.draw(ctx));
    enemyLasers.forEach(l => l.draw(ctx));

    enemies.forEach(e => {
      if (e.active) e.draw(ctx, globalTime);
    });

    player.draw(ctx);
    particles.forEach(p => p.draw(ctx));

    // Sector display watermark
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0, 210, 255, 0.4)';
    ctx.font = '9px "Orbitron"';
    ctx.fillText(`SECTOR ${currentWave}`, WIDTH - 15, HEIGHT - 15);

  } else if (gameState === STATE.LEVEL_CLEAR) {
    stars.forEach(s => s.draw(ctx, 1));
    particles.forEach(p => p.draw(ctx));
    player.draw(ctx);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffcc';
    ctx.font = '18px "Press Start 2P"';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 12;
    ctx.fillText(`SETOR ${currentWave} LIMPO!`, WIDTH / 2, 290);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText(`BÓNUS DEFENSIVO: +${currentWave * 750} PTS`, WIDTH / 2, 340);
    ctx.fillText(`A INIMIGOS FICAM MAIS AGRESSIVOS!`, WIDTH / 2, 375);

    if (Math.floor(globalTime * 2) % 2 === 0) {
      ctx.fillStyle = '#ffaa00';
      ctx.font = '9px "Press Start 2P"';
      ctx.fillText("PRESSIONE ESPAÇO PARA O PRÓXIMO SETOR", WIDTH / 2, 450);
    }

  } else if (gameState === STATE.GAMEOVER) {
    stars.forEach(s => s.draw(ctx, 1));
    particles.forEach(p => p.draw(ctx));

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2255';
    ctx.font = '22px "Press Start 2P"';
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur = 15;
    ctx.fillText("GAME OVER", WIDTH / 2, 280);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = '11px "Press Start 2P"';
    ctx.fillText(`SCORE FINAL: ${score}`, WIDTH / 2, 340);
    ctx.fillText(`SETOR ALCANÇADO: ${currentWave}`, WIDTH / 2, 375);
    ctx.fillText(`RECORDE: ${highScore}`, WIDTH / 2, 410);

    if (Math.floor(globalTime * 2) % 2 === 0) {
      ctx.fillStyle = '#00ffcc';
      ctx.font = '10px "Press Start 2P"';
      ctx.fillText("PRESSIONE ESPAÇO PARA REINICIAR", WIDTH / 2, 490);
    }
  }
}

// Game Loop
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
