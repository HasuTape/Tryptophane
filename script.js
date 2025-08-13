// Tryptophane - Logika gry

const TILE = 32;
const GRID = 25;
const CANVAS_SIZE = TILE * GRID;
const MAX_PLAYERS = 10;

// Tryby gry
const GAME_MODES = {
  CLASSIC: { name: 'Klasyczny (10 graczy)', players: 10, teams: 1 },
  TEAM_2V2V2V2V2: { name: '2v2v2v2v2 (10 graczy)', players: 10, teams: 5 },
  TEAM_5V5: { name: '5v5 (10 graczy)', players: 10, teams: 2 }
};

// Kolory graczy/drużyn
const PLAYER_COLORS = [
  '#7df', '#f77', '#7f7', '#ff7', '#f7f',
  '#7ff', '#fa7', '#a7f', '#7af', '#af7'
];

// Balans / stałe
const SHRINK_START_DELAY = 8.0;
const SHRINK_RATE_TILES = 0.15;
const SHRINK_DPS = 85;
const HEAL_IDLE_TIME = 5.0;
const HEAL_PER_SEC = 60;
const MINE_EXPLOSION_TIME = 5.0; // Nowy czas eksplozji min
const MINE_AREA_RADIUS = 48; // Promień obszarowy min

// Postacie
const THE_LINE = {
  key: 'the-line', name: 'The Line', symbol: '—',
  maxHP: 3000, speed: 4.5, powerFullTime: 1.0,
  basicDamage: 1000,
  ultDamage: 300, ultShots: 10, ultInterval: 0.10, ultCooldown: 0, // Usunięty cooldown ulta
};

const THE_DOT = {
  key: 'the-dot', name: 'The Dot', symbol: '·',
  maxHP: 2000, speed: 3.2, powerFullTime: 0.5,
  basicDamage: 1000,
  mineRadius: MINE_AREA_RADIUS, maxMines: 3,
  ultDamage: 300, ultShots: 10, ultCooldown: 0, orbRadiusTiles: 10, orbLife: 10.0,
};

const POLYLINE = {
  key: 'polyline', name: 'The Polygonal Line', symbol: '∿',
  maxHP: 2000, speed: 4.2, powerFullTime: 1.5,
  basicDamage: 350, basicBounces: 5,
  ultDamage: 500, ultBounces: 10, ultCooldown: 0,
};

const NEG_ROOT = {
  key: 'neg-root', name: 'The Negative Root', symbol: '√−1',
  maxHP: 2500, speed: 5.4, powerFullTime: 1.5,
  basicDamage: 750,
  ultCooldown: 0, iPhaseTime: 3.0, trapDamage: 2000,
};

const THE_PI = {
  key: 'the-pi', name: 'The Pi', symbol: 'π',
  maxHP: 3141, speed: 3.141592, powerFullTime: 1.57,
  basicDamage: 1000, basicRadiusTiles: 3.14, basicDelay: 3.14,
  ultRadiusTiles: 6.283, ultCrossDamage: 2000, ultDuration: 9.42, ultCooldown: 0,
};

const MULTIPLIER = {
  key: 'multiplier', name: 'The Multiplier', symbol: '×',
  maxHP: 2500, speed: 4.2, powerFullTime: 1.5,
  basicDamage: 1000, minDamage: 250,
  ultCooldown: 0,
};

const TEMPLATES = [THE_LINE, THE_DOT, POLYLINE, NEG_ROOT, THE_PI, MULTIPLIER];

// Narzędzia
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const randChoice = (arr) => arr[randInt(0, arr.length - 1)];
const now = () => performance.now() / 1000;
const normalize = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
};

// Elementy DOM
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

const hpEl = document.getElementById('hp');
const powerFillEl = document.getElementById('powerFill');
const ultBadgeEl = document.getElementById('ultBadge');
const aliveEl = document.getElementById('alive');
const endScreenEl = document.getElementById('endScreen');
const resultTitleEl = document.getElementById('resultTitle');
const resultDescEl = document.getElementById('resultDesc');
const restartBtn = document.getElementById('restartBtn');
const charSelectEl = document.getElementById('charSelect');
const charGridEl = document.getElementById('charGrid');
const modeSelectEl = document.getElementById('modeSelect');
const modeGridEl = document.getElementById('modeGrid');

// Zmienne gry
let world = null;
let player = null;
let selectedGameMode = GAME_MODES.CLASSIC;
let keys = new Set();
let mouse = { x: 0, y: 0, down: false };
let isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Joysticki mobilne
let leftJoystick = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
let touchControls = { shoot: false, ult: false };

// Klasy gry
class World {
  constructor() {
    this.map = generateMaze(GRID);
    this.players = [];
    this.projectiles = [];
    this.mines = [];
    this.aoe = [];
    this.rings = [];
    this.wallRegens = [];
    this.shrinkMargin = 0;
    this.startedAt = now();
    this.gameMode = selectedGameMode;
    
    // Znajdź wnęki przy granicy mapy dla spawnu
    this.spawnPoints = this.findSpawnPoints();
  }
  
  findSpawnPoints() {
    const points = [];
    const margin = 2;
    
    // Szukaj wnęk przy krawędziach mapy
    for (let side = 0; side < 4; side++) {
      for (let i = margin; i < GRID - margin; i++) {
        let x, y;
        switch (side) {
          case 0: x = margin; y = i; break; // lewa
          case 1: x = GRID - margin - 1; y = i; break; // prawa
          case 2: x = i; y = margin; break; // góra
          case 3: x = i; y = GRID - margin - 1; break; // dół
        }
        
        if (this.map[y] && this.map[y][x] === 0) {
          // Sprawdź czy to wnęka (otoczona ścianami z 3 stron)
          let wallCount = 0;
          const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          
          for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID || this.map[ny][nx] === 1) {
              wallCount++;
            }
          }
          
          if (wallCount >= 2) {
            points.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, tx: x, ty: y });
          }
        }
      }
    }
    
    return points.slice(0, 10); // Maksymalnie 10 punktów spawnu
  }
}

class WallRegen {
  constructor(x, y, regenAt, trapDamage = 0) {
    this.x = x;
    this.y = y;
    this.regenAt = regenAt;
    this.trapDamage = trapDamage;
  }
}

class Mine {
  constructor(x, y, ownerId, damage, visible = false, radius = MINE_AREA_RADIUS, ghost = false, expiresAt = null) {
    this.x = x;
    this.y = y;
    this.ownerId = ownerId;
    this.damage = damage;
    this.visible = visible;
    this.radius = radius;
    this.ghost = ghost;
    this.expiresAt = expiresAt;
    this.alive = true;
    this.placedAt = now();
    this.exploded = false;
  }
  
  update(dt, world) {
    if (!this.alive) return;
    
    // Sprawdź czy mina powinna eksplodować po 5 sekundach
    if (!this.exploded && now() - this.placedAt >= MINE_EXPLOSION_TIME) {
      this.explode(world);
      return;
    }
    
    if (this.expiresAt && now() >= this.expiresAt) {
      this.alive = false;
      return;
    }
    
    // Sprawdź kolizję z graczami
    for (const p of world.players) {
      if (!p.alive || p.id === this.ownerId) continue;
      const dx = p.x - this.x, dy = p.y - this.y;
      if (dx * dx + dy * dy <= this.radius * this.radius) {
        this.explode(world);
        return;
      }
    }
  }
  
  explode(world) {
    if (this.exploded) return;
    this.exploded = true;
    
    // Obszarowe obrażenia
    for (const p of world.players) {
      if (!p.alive) continue;
      const dx = p.x - this.x, dy = p.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= this.radius) {
        // Obrażenia maleją z odległością
        const damageMultiplier = 1 - (dist / this.radius) * 0.5;
        const finalDamage = this.damage * damageMultiplier;
        p.takeDamage(finalDamage, this.ownerId, world);
      }
    }
    
    this.alive = false;
  }
  
  draw(ctx) {
    if (!this.alive) return;
    
    const timeLeft = MINE_EXPLOSION_TIME - (now() - this.placedAt);
    const isAboutToExplode = timeLeft <= 2.0;
    
    if (this.visible || isAboutToExplode) {
      // Miganie gdy mina ma eksplodować
      if (isAboutToExplode && Math.floor(now() * 8) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
      } else {
        ctx.fillStyle = 'rgba(255, 200, 80, 0.85)';
      }
    } else {
      ctx.fillStyle = 'rgba(200, 200, 200, 0.07)';
    }
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Pokaż obszar rażenia gdy mina ma eksplodować
    if (isAboutToExplode) {
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

class AoEExplosion {
  constructor(x, y, radiusPx, delay, damage, ownerId) {
    this.x = x;
    this.y = y;
    this.radius = radiusPx;
    this.damage = damage;
    this.ownerId = ownerId;
    this.explodeAt = now() + delay;
    this.done = false;
  }
  
  update(dt, world) {
    if (this.done) return;
    if (now() >= this.explodeAt) {
      for (const p of world.players) {
        if (!p.alive || p.id === this.ownerId) continue;
        const dx = p.x - this.x, dy = p.y - this.y;
        if (dx * dx + dy * dy <= this.radius * this.radius) {
          p.takeDamage(this.damage, this.ownerId, world);
        }
      }
      this.done = true;
    }
  }
  
  draw(ctx) {
    if (this.done) return;
    const t = clamp((this.explodeAt - now()) / 0.5, 0, 1);
    ctx.strokeStyle = 'rgba(100,180,255,0.7)';
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = (1 - t) * 20;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

class RingZone {
  constructor(x, y, radiusPx, duration, damageOnCross, ownerId) {
    this.x = x;
    this.y = y;
    this.radius = radiusPx;
    this.expiresAt = now() + duration;
    this.damage = damageOnCross;
    this.ownerId = ownerId;
    this.wasInside = new Map();
  }
  
  update(dt, world) {
    for (const p of world.players) {
      if (!p.alive || p.isClone) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      const inside = d < this.radius;
      const key = p.id;
      const prev = this.wasInside.get(key);
      if (prev !== undefined && prev !== inside) {
        p.takeDamage(this.damage, this.ownerId, world);
      }
      this.wasInside.set(key, inside);
    }
  }
  
  draw(ctx) {
    ctx.strokeStyle = 'rgba(255, 220, 100, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  get alive() {
    return now() < this.expiresAt;
  }
}

class Projectile {
  constructor(x, y, vx, vy, damage, ownerId, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.ownerId = ownerId;
    this.radius = 4;
    this.alive = true;
    this.wallBreak = !!opts.wallBreak;
    this.bounce = !!opts.bounce;
    this.maxBounces = opts.maxBounces || 0;
    this.bounces = 0;
    this.passThrough = !!opts.passThrough;
  }
  
  update(dt, world) {
    if (!this.alive) return;
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    
    // Kolizja ze ścianą
    if (isWallAtPixel(world, nx, ny)) {
      if (this.wallBreak) {
        const tx = Math.floor(nx / TILE), ty = Math.floor(ny / TILE);
        if (world.map[ty] && world.map[ty][tx] === 1) {
          world.map[ty][tx] = 0;
        }
        this.alive = false;
        return;
      }
      if (this.bounce) {
        let bounced = false;
        const testX = isWallAtPixel(world, nx, this.y);
        const testY = isWallAtPixel(world, this.x, ny);
        if (testX) { this.vx = -this.vx; bounced = true; }
        if (testY) { this.vy = -this.vy; bounced = true; }
        if (!bounced) { this.vx = -this.vx; this.vy = -this.vy; }
        this.bounces++;
        if (this.bounces > this.maxBounces) { this.alive = false; return; }
      } else {
        this.alive = false;
        return;
      }
    } else {
      this.x = nx;
      this.y = ny;
    }
    
    // Kolizja z postacią
    for (const p of world.players) {
      if (!p.alive || p.id === this.ownerId) continue;
      const dx = p.x - this.x, dy = p.y - this.y;
      const rr = (p.radius + this.radius);
      if (dx * dx + dy * dy <= rr * rr) {
        p.takeDamage(this.damage, this.ownerId, world);
        if (!this.passThrough) { this.alive = false; }
        return;
      }
    }
  }
  
  draw(ctx) {
    if (!this.alive) return;
    
    // Kolor pocisku zależny od właściciela
    const owner = world.players.find(p => p.id === this.ownerId);
    let color = '#7df';
    if (owner && owner.teamId !== undefined) {
      color = PLAYER_COLORS[owner.teamId % PLAYER_COLORS.length];
    }
    
    if (this.wallBreak) color = '#f55';
    else if (this.bounce) color = '#9cf';
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class SplitProjectile extends Projectile {
  constructor(x, y, vx, vy, damage, ownerId, splitAfterPx, minDamage) {
    super(x, y, vx, vy, damage, ownerId);
    this.dist = 0;
    this.splitAfter = splitAfterPx;
    this.minDamage = minDamage;
  }
  
  update(dt, world) {
    if (!this.alive) return;
    const stepX = this.vx * dt, stepY = this.vy * dt;
    this.dist += Math.hypot(stepX, stepY);
    super.update(dt, world);
    if (!this.alive) return;
    
    if (this.dist >= this.splitAfter && this.damage / 2 >= this.minDamage) {
      const a = Math.atan2(this.vy, this.vx);
      const s = Math.hypot(this.vx, this.vy);
      const offsets = [Math.PI / 12, -Math.PI / 12, Math.PI / 6, -Math.PI / 6];
      for (const off of offsets) {
        const na = a + off;
        const nvx = Math.cos(na) * s, nvy = Math.sin(na) * s;
        const sp = new SplitProjectile(this.x, this.y, nvx, nvy, this.damage / 2, this.ownerId, this.splitAfter, this.minDamage);
        world.projectiles.push(sp);
      }
      this.alive = false;
    }
  }
}

class Actor {
  constructor(template, x, y, isPlayer = false, isClone = false) {
    this.template = template;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hp = template.maxHP;
    this.maxHP = template.maxHP;
    this.speed = template.speed;
    this.radius = 12;
    this.alive = true;
    this.isPlayer = isPlayer;
    this.isClone = isClone;
    this.id = Math.random();
    this.teamId = 0; // Będzie ustawione podczas spawnu
    
    this.power = 0;
    this.powerRate = 100 / template.powerFullTime;
    this.ultReady = false;
    this.ultCd = 0;
    this.ultBurst = null;
    this.switchCd = 0;
    this.clones = [];
    this.ownerId = null;
    this.frozenUntil = 0;
    this.lastCombatTime = 0;
    this.kills = 0;
    
    // AI właściwości
    this.aiTarget = null;
    this.aiLastTargetUpdate = 0;
    this.aiFleeUntil = 0;
    this.aiAvoidZoneUntil = 0;
  }
  
  get inCombat() {
    return (now() - this.lastCombatTime) < HEAL_IDLE_TIME;
  }
  
  takeDamage(amount, attackerId, world) {
    this.hp -= amount;
    this.lastCombatTime = now();
    if (this.hp <= 0) {
      this.alive = false;
      if (this.isClone && attackerId) {
        const killer = world.players.find(p => p.id === attackerId);
        if (killer) {
          killer.takeDamage(1000, this.id, world);
        }
      }
      const killer = world.players.find(p => p.id === attackerId);
      if (killer) {
        killer.kills++;
        killer.ultReady = true; // Zabijasz - dostajesz ulta
      }
    }
  }
  
  heal(dt) {
    if (this.alive && !this.inCombat) {
      this.hp = clamp(this.hp + HEAL_PER_SEC * dt, 0, this.maxHP);
    }
  }
  
  chargePower(dt) {
    if (this.alive) {
      this.power = clamp(this.power + this.powerRate * dt, 0, 100);
    }
  }
  
  tryBasicAttack(targetDir, world, powerPercent = 100) {
    if (!this.alive) return false;
    
    // Można strzelać bez pełnego paska, ale z proporcjonalnymi obrażeniami
    const actualPowerPercent = Math.max(0, Math.min(100, powerPercent || this.power));
    const damageMultiplier = actualPowerPercent / 100;
    
    const [dx, dy] = normalize(targetDir[0], targetDir[1]);
    const px = this.x + dx * (this.radius + 2), py = this.y + dy * (this.radius + 2);
    const t = this.template.key;
    
    if (t === 'the-line') {
      const speed = 480;
      const damage = this.template.basicDamage * damageMultiplier;
      world.projectiles.push(new Projectile(px, py, dx * speed, dy * speed, damage, this.id));
    } else if (t === 'the-dot') {
      const place = placeWithinRadiusIgnoreWalls(world, this.x, this.y, dx, dy, 3);
      const myMines = world.mines.filter(m => m.ownerId === this.id && m.alive);
      if (myMines.length >= this.template.maxMines) {
        myMines[0].alive = false;
      }
      const damage = this.template.basicDamage * damageMultiplier;
      world.mines.push(new Mine(place.x, place.y, this.id, damage, false, this.template.mineRadius, false, now() + 30));
    } else if (t === 'polyline') {
      const angles = [0, Math.PI / 6, -Math.PI / 6];
      const baseA = Math.atan2(dy, dx);
      const damage = this.template.basicDamage * damageMultiplier;
      for (const aOff of angles) {
        const a = baseA + aOff;
        const vx = Math.cos(a) * 520, vy = Math.sin(a) * 520;
        world.projectiles.push(new Projectile(px, py, vx, vy, damage, this.id, { bounce: true, maxBounces: this.template.basicBounces }));
      }
    } else if (t === 'neg-root') {
      const hit = raycast(world, this.x, this.y, dx, dy, TILE * 12, true, this.id);
      if (hit && hit.type === 'actor') {
        const damage = this.template.basicDamage * damageMultiplier;
        hit.actor.takeDamage(damage, this.id, world);
      }
    } else if (t === 'the-pi') {
      const place = placeWithinRadiusIgnoreWalls(world, this.x, this.y, dx, dy, 3);
      const damage = this.template.basicDamage * damageMultiplier;
      world.aoe.push(new AoEExplosion(place.x, place.y, this.template.basicRadiusTiles * TILE * 0.5, this.template.basicDelay, damage, this.id));
    } else if (t === 'multiplier') {
      const damage = this.template.basicDamage * damageMultiplier;
      const sp = new SplitProjectile(px, py, dx * 520, dy * 520, damage, this.id, 1 * TILE, this.template.minDamage);
      world.projectiles.push(sp);
    }
    
    this.power = Math.max(0, this.power - actualPowerPercent);
    this.lastCombatTime = now();
    return true;
  }
  
  tryUlt(targetDir, world) {
    if (!this.alive || !this.ultReady) return false; // Usunięty cooldown
    
    const [dx, dy] = normalize(targetDir[0], targetDir[1]);
    const t = this.template.key;
    
    if (t === 'the-line') {
      const speed = 520;
      const px = this.x + dx * (this.radius + 2), py = this.y + dy * (this.radius + 2);
      world.projectiles.push(new Projectile(px, py, dx * speed, dy * speed, this.template.ultDamage, this.id, { wallBreak: true }));
      this.ultBurst = {
        shotsLeft: Math.max(0, this.template.ultShots - 1),
        nextAt: now() + this.template.ultInterval,
        interval: this.template.ultInterval,
        dir: [dx, dy],
        speed,
        damage: this.template.ultDamage,
        wallBreak: true
      };
    } else if (t === 'the-dot') {
      const center = placeAnywhere(world, this.x, this.y, dx, dy);
      const R = this.template.orbRadiusTiles * TILE * 0.5;
      const life = this.template.orbLife;
      for (let i = 0; i < this.template.ultShots; i++) {
        const ang = (i / this.template.ultShots) * Math.PI * 2;
        const mx = center.x + Math.cos(ang) * R;
        const my = center.y + Math.sin(ang) * R;
        const m = new Mine(mx, my, this.id, this.template.ultDamage, true, 18, true, now() + life);
        const baseUpdate = m.update.bind(m);
        m.update = (dt2, world2) => {
          const tsec = now();
          const a = ang + (tsec * 0.4);
          m.x = center.x + Math.cos(a) * R * (1 - 0.3 * ((tsec) % life) / life);
          m.y = center.y + Math.sin(a) * R * (1 - 0.3 * ((tsec) % life) / life);
          baseUpdate(dt2, world2);
        };
        world.mines.push(m);
      }
    } else if (t === 'polyline') {
      const speed = 540;
      const px = this.x + dx * (this.radius + 2), py = this.y + dy * (this.radius + 2);
      const pr = new Projectile(px, py, dx * speed, dy * speed, this.template.ultDamage, this.id, { bounce: true, maxBounces: this.template.ultBounces, passThrough: true });
      const baseUpdate = pr.update.bind(pr);
      pr.update = (dt, world) => {
        const prevB = pr.bounces;
        baseUpdate(dt, world);
        if (!pr.alive) return;
        if (pr.bounces > prevB) {
          const target = findNearestEnemy(world, pr.x, pr.y, pr.ownerId);
          if (target) {
            const [nx, ny] = normalize(target.x - pr.x, target.y - pr.y);
            const s = Math.hypot(pr.vx, pr.vy) || 1;
            pr.vx = nx * s;
            pr.vy = ny * s;
          }
        }
      };
      world.projectiles.push(pr);
    } else if (t === 'neg-root') {
      const hit = raycast(world, this.x, this.y, dx, dy, TILE * 12, true, this.id);
      if (hit) {
        if (hit.type === 'actor') {
          const target = hit.actor;
          target.frozenUntil = now() + this.template.iPhaseTime;
        } else if (hit.type === 'wall') {
          world.map[hit.ty][hit.tx] = 0;
          world.wallRegens.push(new WallRegen(hit.tx, hit.ty, now() + this.template.iPhaseTime, this.template.trapDamage));
        }
      }
    } else if (t === 'the-pi') {
      const center = this.isPlayer ? { x: clamp(mouse.x, 0, CANVAS_SIZE), y: clamp(mouse.y, 0, CANVAS_SIZE) } : { x: clamp(this.x + dx * TILE * 6, 0, CANVAS_SIZE), y: clamp(this.y + dy * TILE * 6, 0, CANVAS_SIZE) };
      world.rings.push(new RingZone(center.x, center.y, this.template.ultRadiusTiles * TILE * 0.5, this.template.ultDuration, this.template.ultCrossDamage, this.id));
    } else if (t === 'multiplier') {
      this.clones.forEach(c => c.alive = false);
      this.clones = [];
      const spots = findNearbyOpenSpots(world, this.x, this.y, 8).filter(s => inSafeRect(world, s.x, s.y));
      for (let i = 0; i < 2; i++) {
        const s = spots[i] || { x: clamp(this.x + (i ? +TILE : -TILE), TILE, CANVAS_SIZE - TILE), y: clamp(this.y, TILE, CANVAS_SIZE - TILE) };
        const clone = new Actor(this.template, s.x, s.y, false, true);
        clone.ownerId = this.id;
        clone.hp = Math.max(1, Math.floor(this.maxHP * 0.5));
        clone.teamId = this.teamId;
        world.players.push(clone);
        this.clones.push(clone);
      }
      this.switchCd = 0.25;
    }
    
    this.ultReady = false;
    this.power = 0;
    this.lastCombatTime = now();
    return true;
  }
}

// Funkcje pomocnicze
function generateMaze(gridSize) {
  const w = gridSize, h = gridSize;
  const grid = new Array(h).fill(0).map(() => new Array(w).fill(1));
  const inBounds = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1;
  const stack = [];
  let sx = (randInt(0, Math.floor((w - 1) / 2)) * 2) + 1;
  let sy = (randInt(0, Math.floor((h - 1) / 2)) * 2) + 1;
  grid[sy][sx] = 0;
  stack.push([sx, sy]);
  const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
  
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = dirs.map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
      .filter(([nx, ny]) => inBounds(nx, ny) && grid[ny][nx] === 1);
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = randChoice(options);
    grid[cy + dy / 2][cx + dx / 2] = 0;
    grid[ny][nx] = 0;
    stack.push([nx, ny]);
  }
  
  for (let x = 0; x < w; x++) {
    grid[0][x] = 1;
    grid[h - 1][x] = 1;
  }
  for (let y = 0; y < h; y++) {
    grid[y][0] = 1;
    grid[y][w - 1] = 1;
  }
  
  return grid;
}

function isWallAt(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= GRID || ty >= GRID) return true;
  return world.map[ty][tx] === 1;
}

function isWallAtPixel(world, px, py) {
  return isWallAt(world, Math.floor(px / TILE), Math.floor(py / TILE));
}

function randomOpenTile(world) {
  let attempts = 0;
  while (attempts < 1000) {
    const tx = randInt(1, GRID - 2);
    const ty = randInt(1, GRID - 2);
    if (world.map[ty][tx] === 0) {
      return { tx, ty };
    }
    attempts++;
  }
  return { tx: 1, ty: 1 };
}

function randomTemplate() {
  return randChoice(TEMPLATES);
}

function findNearestEnemy(world, x, y, ownerId) {
  let nearest = null;
  let minDist = Infinity;
  
  for (const p of world.players) {
    if (!p.alive || p.id === ownerId) continue;
    
    // W trybach drużynowych, nie atakuj członków swojej drużyny
    const owner = world.players.find(pl => pl.id === ownerId);
    if (owner && owner.teamId !== undefined && p.teamId === owner.teamId) continue;
    
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  }
  
  return nearest;
}

function lineOfSight(world, x1, y1, dx, dy) {
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * TILE * 8 * t;
    const y = y1 + dy * TILE * 8 * t;
    if (isWallAtPixel(world, x, y)) return false;
  }
  return true;
}

function raycast(world, x, y, dx, dy, maxDist, includeActors, ignoreId) {
  const steps = Math.ceil(maxDist / 4);
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * maxDist;
    const px = x + dx * t;
    const py = y + dy * t;
    
    if (includeActors) {
      for (const p of world.players) {
        if (!p.alive || p.id === ignoreId) continue;
        const dist = Math.hypot(p.x - px, p.y - py);
        if (dist <= p.radius) {
          return { type: 'actor', actor: p, x: px, y: py };
        }
      }
    }
    
    if (isWallAtPixel(world, px, py)) {
      return {
        type: 'wall',
        x: px, y: py,
        tx: Math.floor(px / TILE),
        ty: Math.floor(py / TILE)
      };
    }
  }
  
  return null;
}

function placeWithinRadiusIgnoreWalls(world, x, y, dx, dy, radiusTiles) {
  const maxDist = radiusTiles * TILE;
  const targetX = x + dx * maxDist;
  const targetY = y + dy * maxDist;
  return { x: clamp(targetX, TILE, CANVAS_SIZE - TILE), y: clamp(targetY, TILE, CANVAS_SIZE - TILE) };
}

function placeAnywhere(world, x, y, dx, dy) {
  return { x: clamp(x + dx * TILE * 6, TILE, CANVAS_SIZE - TILE), y: clamp(y + dy * TILE * 6, TILE, CANVAS_SIZE - TILE) };
}

function findNearbyOpenSpots(world, x, y, radius) {
  const spots = [];
  const centerTx = Math.floor(x / TILE);
  const centerTy = Math.floor(y / TILE);
  
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const tx = centerTx + dx;
      const ty = centerTy + dy;
      if (tx >= 0 && ty >= 0 && tx < GRID && ty < GRID && world.map[ty][tx] === 0) {
        spots.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
      }
    }
  }
  
  return spots;
}

function inSafeRect(world, x, y) {
  const marginPx = world.shrinkMargin * TILE;
  const safe = {
    x1: marginPx,
    y1: marginPx,
    x2: CANVAS_SIZE - marginPx,
    y2: CANVAS_SIZE - marginPx
  };
  return x >= safe.x1 && x <= safe.x2 && y >= safe.y1 && y <= safe.y2;
}

function carveShrinkedWalls(world) {
  const margin = Math.floor(world.shrinkMargin);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (x < margin || x >= GRID - margin || y < margin || y >= GRID - margin) {
        world.map[y][x] = 1;
      }
    }
  }
}

function tryMove(world, actor, dt) {
  if (actor.frozenUntil && now() < actor.frozenUntil) {
    actor.vx = 0;
    actor.vy = 0;
    return;
  }
  
  const speed = actor.speed * (60 * dt);
  const nx = actor.x + actor.vx * speed;
  const ny = actor.y + actor.vy * speed;
  
  const tryX = () => {
    if (!circleHitsWall(world, nx, actor.y, actor.radius)) actor.x = nx;
  };
  const tryY = () => {
    if (!circleHitsWall(world, actor.x, ny, actor.radius)) actor.y = ny;
  };
  
  tryX();
  tryY();
}

function circleHitsWall(world, cx, cy, r) {
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (isWallAtPixel(world, px, py)) return true;
  }
  return false;
}

// Spawning
function spawnActors(world, playerTemplate) {
  const spawnPoints = [...world.spawnPoints];
  
  // Gracz
  const playerSpawn = spawnPoints.shift() || { x: TILE * 2, y: TILE * 2 };
  const a = new Actor(playerTemplate, playerSpawn.x, playerSpawn.y, true);
  a.teamId = 0;
  world.players.push(a);
  player = a;
  
  // Boty
  const need = selectedGameMode.players - 1;
  for (let i = 0; i < need; i++) {
    const spawn = spawnPoints.shift() || randomOpenTile(world);
    const spawnX = spawn.x || spawn.tx * TILE + TILE / 2;
    const spawnY = spawn.y || spawn.ty * TILE + TILE / 2;
    const tpl = randomTemplate();
    const b = new Actor(tpl, spawnX, spawnY, false);
    
    // Przypisz drużynę
    if (selectedGameMode === GAME_MODES.TEAM_2V2V2V2V2) {
      b.teamId = Math.floor(i / 2) + 1; // 5 drużyn po 2 graczy
    } else if (selectedGameMode === GAME_MODES.TEAM_5V5) {
      b.teamId = i < 4 ? 1 : 2; // 2 drużyny po 5 graczy (gracz + 4 boty vs 5 botów)
    } else {
      b.teamId = i + 1; // Każdy ma swoją drużynę
    }
    
    world.players.push(b);
  }
}

// AI z nowymi priorytetami
function aiUpdate(world, dt) {
  for (const a of world.players) {
    if (a.isPlayer || !a.alive || a.isClone) continue;
    
    const currentTime = now();
    
    // 1. Priorytet: Zabić przeciwnika
    let target = findNearestEnemy(world, a.x, a.y, a.id);
    
    // 2. Priorytet: Przeżycie (ucieczka gdy mało HP)
    const lowHP = (a.hp / a.maxHP) < 0.25;
    
    // 3. Priorytet: Uciekanie od strefy
    const marginPx = world.shrinkMargin * TILE;
    const safe = {
      x1: marginPx + TILE,
      y1: marginPx + TILE,
      x2: CANVAS_SIZE - marginPx - TILE,
      y2: CANVAS_SIZE - marginPx - TILE
    };
    const inDanger = a.x < safe.x1 || a.x > safe.x2 || a.y < safe.y1 || a.y > safe.y2;
    
    let mvx = 0, mvy = 0;
    
    if (inDanger) {
      // Priorytet 3: Uciekaj od strefy
      const centerX = CANVAS_SIZE / 2;
      const centerY = CANVAS_SIZE / 2;
      const [dx, dy] = normalize(centerX - a.x, centerY - a.y);
      mvx = dx;
      mvy = dy;
    } else if (lowHP && target) {
      // Priorytet 2: Uciekaj gdy mało HP
      const [dx, dy] = normalize(target.x - a.x, target.y - a.y);
      mvx = -dx;
      mvy = -dy;
    } else if (target) {
      // Priorytet 1: Atakuj przeciwnika
      const dx = target.x - a.x, dy = target.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const [nx, ny] = [dx / dist, dy / dist];
      
      const optimalRange = TILE * 6;
      if (dist < optimalRange * 0.7) {
        // Za blisko - cofnij się
        mvx = -nx * 0.8;
        mvy = -ny * 0.8;
      } else if (dist > optimalRange * 1.3) {
        // Za daleko - podejdź
        mvx = nx;
        mvy = ny;
      } else {
        // Optymalna odległość - strafe
        const perpX = -ny, perpY = nx;
        const strafeDir = (Math.random() < 0.5 ? 1 : -1);
        mvx = perpX * strafeDir * 0.7;
        mvy = perpY * strafeDir * 0.7;
      }
      
      // Unikaj ścian
      const fwdX = a.x + nx * TILE * 0.5;
      const fwdY = a.y + ny * TILE * 0.5;
      if (isWallAtPixel(world, fwdX, fwdY)) {
        mvx += -ny * 0.8;
        mvy += nx * 0.8;
      }
    }
    
    // Normalizuj ruch
    [mvx, mvy] = normalize(mvx, mvy);
    a.vx = mvx;
    a.vy = mvy;
    
    // Strzelanie
    if (target && a.power >= 50) { // Boty strzelają przy 50% mocy
      const dx = target.x - a.x, dy = target.y - a.y;
      const dist = Math.hypot(dx, dy);
      const [nx, ny] = normalize(dx, dy);
      
      const key = a.template.key;
      if (key === 'the-dot' || key === 'the-pi') {
        a.tryBasicAttack([nx, ny], world, a.power);
      } else {
        if (lineOfSight(world, a.x, a.y, nx, ny)) {
          a.tryBasicAttack([nx, ny], world, a.power);
        }
      }
    }
    
    // Używanie ulta
    if (a.ultReady && target) {
      const dx = target.x - a.x, dy = target.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < TILE * 9) {
        const [nx, ny] = normalize(dx, dy);
        a.tryUlt([nx, ny], world);
      }
    }
  }
}

// Obsługa zdarzeń
function setupEventListeners() {
  // Klawiatura
  document.addEventListener('keydown', (e) => {
    keys.add(e.code.toLowerCase());
    e.preventDefault();
  });
  
  document.addEventListener('keyup', (e) => {
    keys.delete(e.code.toLowerCase());
    e.preventDefault();
  });
  
  // Mysz
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
  });
  
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      e.preventDefault();
    }
  });
  
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouse.down = false;
      e.preventDefault();
    }
  });
  
  // Touch controls dla mobile
  if (isMobile) {
    setupMobileControls();
  }
}

function setupMobileControls() {
  // Dodaj kontrolki mobilne do DOM
  const mobileControls = document.createElement('div');
  mobileControls.className = 'mobile-controls';
  mobileControls.innerHTML = `
    <div class="joystick" id="moveJoystick">
      <div class="joystick-knob" id="moveKnob"></div>
    </div>
    <div class="action-buttons">
      <div class="action-btn" id="ultBtn">ULT</div>
      <div class="action-btn" id="shootBtn">🎯</div>
    </div>
  `;
  document.body.appendChild(mobileControls);
  
  const moveJoystick = document.getElementById('moveJoystick');
  const moveKnob = document.getElementById('moveKnob');
  const shootBtn = document.getElementById('shootBtn');
  const ultBtn = document.getElementById('ultBtn');
  
  // Joystick ruchu
  let joystickActive = false;
  
  function handleJoystickStart(e) {
    joystickActive = true;
    const rect = moveJoystick.getBoundingClientRect();
    leftJoystick.startX = rect.left + rect.width / 2;
    leftJoystick.startY = rect.top + rect.height / 2;
    e.preventDefault();
  }
  
  function handleJoystickMove(e) {
    if (!joystickActive) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - leftJoystick.startX;
    const dy = touch.clientY - leftJoystick.startY;
    const distance = Math.hypot(dx, dy);
    const maxDistance = 30;
    
    if (distance <= maxDistance) {
      leftJoystick.currentX = dx;
      leftJoystick.currentY = dy;
    } else {
      const angle = Math.atan2(dy, dx);
      leftJoystick.currentX = Math.cos(angle) * maxDistance;
      leftJoystick.currentY = Math.sin(angle) * maxDistance;
    }
    
    moveKnob.style.transform = `translate(calc(-50% + ${leftJoystick.currentX}px), calc(-50% + ${leftJoystick.currentY}px))`;
    e.preventDefault();
  }
  
  function handleJoystickEnd(e) {
    joystickActive = false;
    leftJoystick.currentX = 0;
    leftJoystick.currentY = 0;
    moveKnob.style.transform = 'translate(-50%, -50%)';
    e.preventDefault();
  }
  
  moveJoystick.addEventListener('touchstart', handleJoystickStart);
  document.addEventListener('touchmove', handleJoystickMove);
  document.addEventListener('touchend', handleJoystickEnd);
  
  // Przyciski akcji
  shootBtn.addEventListener('touchstart', (e) => {
    touchControls.shoot = true;
    e.preventDefault();
  });
  
  shootBtn.addEventListener('touchend', (e) => {
    touchControls.shoot = false;
    e.preventDefault();
  });
  
  ultBtn.addEventListener('touchstart', (e) => {
    touchControls.ult = true;
    e.preventDefault();
  });
  
  ultBtn.addEventListener('touchend', (e) => {
    touchControls.ult = false;
    e.preventDefault();
  });
}

// Funkcje gry
function startRound(playerTemplate) {
  world = new World();
  spawnActors(world, playerTemplate);
  endScreenEl.style.display = 'none';
  charSelectEl.style.display = 'none';
  modeSelectEl.style.display = 'none';
}

function showModeSelect() {
  buildModeSelect();
  modeSelectEl.style.display = 'flex';
  endScreenEl.style.display = 'none';
  charSelectEl.style.display = 'none';
  world = null;
  player = null;
}

function buildModeSelect() {
  modeGridEl.innerHTML = '';
  for (const [key, mode] of Object.entries(GAME_MODES)) {
    const btn = document.createElement('button');
    btn.textContent = mode.name;
    btn.addEventListener('click', () => {
      selectedGameMode = mode;
      showCharSelect();
    });
    modeGridEl.appendChild(btn);
  }
}

function buildCharSelect() {
  charGridEl.innerHTML = '';
  for (const tpl of TEMPLATES) {
    const btn = document.createElement('button');
    btn.className = 'charBtn';
    btn.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <div style="width:28px; height:28px; border-radius:50%; background:#2e5cff; color:#11131a; display:flex; align-items:center; justify-content:center; font-weight:700;">${tpl.symbol}</div>
        <div style="font-weight:700;">${tpl.name}</div>
      </div>
      <div style="opacity:.8; font-size:12px;">HP: ${tpl.maxHP} • Prędkość: ${tpl.speed.toFixed ? tpl.speed.toFixed(2) : tpl.speed} • Pasek: ${tpl.powerFullTime}s</div>`;
    btn.addEventListener('click', () => startRound(tpl));
    charGridEl.appendChild(btn);
  }
}

function showCharSelect() {
  buildCharSelect();
  charSelectEl.style.display = 'flex';
  endScreenEl.style.display = 'none';
  modeSelectEl.style.display = 'none';
  world = null;
  player = null;
}

// Wskaźnik celowania
function drawAimIndicator(ctx) {
  if (!player || !player.alive) return;
  
  const dx = mouse.x - player.x;
  const dy = mouse.y - player.y;
  const dist = Math.hypot(dx, dy);
  
  if (dist < 10) return;
  
  const [nx, ny] = normalize(dx, dy);
  
  // Pokaż gdzie wyląduje atak
  let targetX = player.x;
  let targetY = player.y;
  let range = 0;
  
  const t = player.template.key;
  if (t === 'the-line' || t === 'polyline' || t === 'multiplier') {
    // Pociski - pokaż trajektorię do ściany lub maksymalny zasięg
    const maxRange = TILE * 15;
    const hit = raycast(world, player.x, player.y, nx, ny, maxRange, false, player.id);
    if (hit) {
      targetX = hit.x;
      targetY = hit.y;
      range = Math.hypot(targetX - player.x, targetY - player.y);
    } else {
      targetX = player.x + nx * maxRange;
      targetY = player.y + ny * maxRange;
      range = maxRange;
    }
  } else if (t === 'the-dot') {
    // Miny - pokaż gdzie zostanie umieszczona
    const place = placeWithinRadiusIgnoreWalls(world, player.x, player.y, nx, ny, 3);
    targetX = place.x;
    targetY = place.y;
    range = Math.hypot(targetX - player.x, targetY - player.y);
  } else if (t === 'neg-root') {
    // Raycast - pokaż linię celowania
    const hit = raycast(world, player.x, player.y, nx, ny, TILE * 12, true, player.id);
    if (hit) {
      targetX = hit.x;
      targetY = hit.y;
      range = Math.hypot(targetX - player.x, targetY - player.y);
    } else {
      targetX = player.x + nx * TILE * 12;
      targetY = player.y + ny * TILE * 12;
      range = TILE * 12;
    }
  } else if (t === 'the-pi') {
    // AoE - pokaż obszar eksplozji
    const place = placeWithinRadiusIgnoreWalls(world, player.x, player.y, nx, ny, 3);
    targetX = place.x;
    targetY = place.y;
    range = Math.hypot(targetX - player.x, targetY - player.y);
  }
  
  // Rysuj linię trajektorii
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Rysuj punkt docelowy
  ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
  ctx.beginPath();
  ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Dla AoE, pokaż obszar rażenia
  if (t === 'the-pi') {
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, player.template.basicRadiusTiles * TILE * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (t === 'the-dot') {
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, MINE_AREA_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Główna pętla gry
function tick() {
  if (!world) return;
  
  const dt = 1 / 60;
  update(dt);
  draw();
}

function update(dt) {
  // Kurczenie się strefy
  const elapsed = now() - world.startedAt;
  if (elapsed > SHRINK_START_DELAY) {
    world.shrinkMargin += SHRINK_RATE_TILES * dt;
    carveShrinkedWalls(world);
  }
  
  // Regeneracja ścian
  for (let i = world.wallRegens.length - 1; i >= 0; i--) {
    const wr = world.wallRegens[i];
    if (now() >= wr.regenAt) {
      world.map[wr.y][wr.x] = 1;
      world.wallRegens.splice(i, 1);
    }
  }
  
  // Input gracza
  if (player && player.alive) {
    let mvx = 0, mvy = 0;
    
    if (isMobile) {
      // Kontrolki mobilne
      const deadzone = 5;
      if (Math.abs(leftJoystick.currentX) > deadzone || Math.abs(leftJoystick.currentY) > deadzone) {
        mvx = leftJoystick.currentX / 30;
        mvy = leftJoystick.currentY / 30;
      }
      
      if (touchControls.shoot) {
        const dx = mouse.x - player.x;
        const dy = mouse.y - player.y;
        if (Math.hypot(dx, dy) > 10) {
          player.tryBasicAttack([dx, dy], world, player.power);
        }
      }
      
      if (touchControls.ult) {
        const dx = mouse.x - player.x;
        const dy = mouse.y - player.y;
        if (Math.hypot(dx, dy) > 10) {
          player.tryUlt([dx, dy], world);
        }
        touchControls.ult = false;
      }
    } else {
      // Kontrolki klawiatury
      if (keys.has('keyw') || keys.has('arrowup')) mvy -= 1;
      if (keys.has('keys') || keys.has('arrowdown')) mvy += 1;
      if (keys.has('keya') || keys.has('arrowleft')) mvx -= 1;
      if (keys.has('keyd') || keys.has('arrowright')) mvx += 1;
      
      if (mouse.down) {
        const dx = mouse.x - player.x;
        const dy = mouse.y - player.y;
        if (Math.hypot(dx, dy) > 10) {
          player.tryBasicAttack([dx, dy], world, player.power);
        }
      }
      
      if (keys.has('space')) {
        const dx = mouse.x - player.x;
        const dy = mouse.y - player.y;
        if (Math.hypot(dx, dy) > 10) {
          player.tryUlt([dx, dy], world);
        }
      }
    }
    
    [mvx, mvy] = normalize(mvx, mvy);
    player.vx = mvx;
    player.vy = mvy;
  }
  
  // Aktualizacja postaci
  for (const a of world.players) {
    if (!a.alive) continue;
    
    a.heal(dt);
    a.chargePower(dt);
    
    if (a.ultBurst) {
      if (now() >= a.ultBurst.nextAt && a.ultBurst.shotsLeft > 0) {
        const [dx, dy] = a.ultBurst.dir;
        const px = a.x + dx * (a.radius + 2);
        const py = a.y + dy * (a.radius + 2);
        const opts = a.ultBurst.wallBreak ? { wallBreak: true } : {};
        world.projectiles.push(new Projectile(px, py, dx * a.ultBurst.speed, dy * a.ultBurst.speed, a.ultBurst.damage, a.id, opts));
        a.ultBurst.shotsLeft--;
        a.ultBurst.nextAt = now() + a.ultBurst.interval;
      }
      if (a.ultBurst.shotsLeft <= 0) {
        a.ultBurst = null;
      }
    }
    
    if (a.switchCd > 0) {
      a.switchCd -= dt;
    }
    
    tryMove(world, a, dt);
    
    // Obrażenia od strefy
    if (!inSafeRect(world, a.x, a.y)) {
      a.takeDamage(SHRINK_DPS * dt, null, world);
    }
  }
  
  // AI
  aiUpdate(world, dt);
  
  // Aktualizacja obiektów
  world.mines = world.mines.filter(m => {
    m.update(dt, world);
    return m.alive;
  });
  
  world.aoe = world.aoe.filter(a => {
    a.update(dt, world);
    return !a.done;
  });
  
  world.rings = world.rings.filter(r => {
    r.update(dt, world);
    return r.alive;
  });
  
  world.projectiles = world.projectiles.filter(p => {
    p.update(dt, world);
    return p.alive;
  });
  
  // Usuń martwe postacie
  world.players = world.players.filter(p => p.alive);
  
  // Sprawdź koniec gry
  const alivePlayers = world.players.filter(p => !p.isClone);
  if (alivePlayers.length <= 1) {
    const winner = alivePlayers[0];
    let title, desc;
    
    if (!winner) {
      title = 'Remis!';
      desc = 'Wszyscy gracze zostali wyeliminowani.';
    } else if (winner.isPlayer) {
      title = 'Zwycięstwo!';
      desc = `Wygrałeś jako ${winner.template.name}!`;
    } else {
      title = 'Porażka!';
      desc = `Wygrał ${winner.template.name}.`;
    }
    
    resultTitleEl.textContent = title;
    resultDescEl.textContent = desc;
    endScreenEl.style.display = 'flex';
  }
  
  // Aktualizacja UI
  updateHUD();
}

function updateHUD() {
  if (!player || !player.alive) {
    hpEl.textContent = '0';
    powerFillEl.style.width = '0%';
    ultBadgeEl.style.opacity = '0.3';
    aliveEl.textContent = '0';
    return;
  }
  
  hpEl.textContent = Math.ceil(player.hp);
  powerFillEl.style.width = `${player.power}%`;
  ultBadgeEl.style.opacity = player.ultReady ? '1' : '0.3';
  
  const alive = world.players.filter(p => !p.isClone).length;
  aliveEl.textContent = alive;
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  
  if (!world) return;
  
  // Mapa
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (world.map[y][x] === 1) {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
  
  // Strefa kurczenia się
  const marginPx = world.shrinkMargin * TILE;
  if (marginPx > 0) {
    ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
    
    // Górna
    ctx.fillRect(0, 0, CANVAS_SIZE, marginPx);
    // Dolna
    ctx.fillRect(0, CANVAS_SIZE - marginPx, CANVAS_SIZE, marginPx);
    // Lewa
    ctx.fillRect(0, marginPx, marginPx, CANVAS_SIZE - 2 * marginPx);
    // Prawa
    ctx.fillRect(CANVAS_SIZE - marginPx, marginPx, marginPx, CANVAS_SIZE - 2 * marginPx);
  }
  
  // Obiekty
  world.mines.forEach(m => m.draw(ctx));
  world.aoe.forEach(a => a.draw(ctx));
  world.rings.forEach(r => r.draw(ctx));
  world.projectiles.forEach(p => p.draw(ctx));
  
  // Gracze
  for (const p of world.players) {
    if (!p.alive) continue;
    
    // Cień
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y + 2, p.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Ciało gracza z kolorem drużyny
    let color = PLAYER_COLORS[p.teamId % PLAYER_COLORS.length];
    if (p.isClone) color = 'rgba(150, 150, 150, 0.7)';
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Symbol postaci
    ctx.fillStyle = '#000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.template.symbol, p.x, p.y);
    
    // Pasek HP
    const hpBarWidth = 24;
    const hpBarHeight = 4;
    const hpPercent = p.hp / p.maxHP;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(p.x - hpBarWidth / 2, p.y - p.radius - 8, hpBarWidth, hpBarHeight);
    
    ctx.fillStyle = hpPercent > 0.5 ? '#4f4' : hpPercent > 0.25 ? '#ff4' : '#f44';
    ctx.fillRect(p.x - hpBarWidth / 2, p.y - p.radius - 8, hpBarWidth * hpPercent, hpBarHeight);
    
    // Nazwa gracza
    if (p.isPlayer) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.fillText('TY', p.x, p.y + p.radius + 12);
    }
  }
  
  // Wskaźnik celowania
  if (player && player.alive) {
    drawAimIndicator(ctx);
  }
}

// Inicjalizacja
setupEventListeners();
restartBtn.addEventListener('click', showModeSelect);

// Start gry
setInterval(tick, 1000 / 60);
showModeSelect();