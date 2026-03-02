import { useState, useEffect, useCallback, useRef } from "react";

const GRID_COLS = 10;
const GRID_ROWS = 14;
const CELL_SIZE = 38;
const TICK_RATE = 60;

const PATH = [
  [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[5,3],[5,4],[5,5],[5,6],
  [4,6],[3,6],[2,6],[1,6],[1,7],[1,8],[1,9],[2,9],[3,9],[4,9],
  [5,9],[6,9],[7,9],[7,10],[7,11],[7,12],[7,13],[8,13],[9,13]
];

const pathSet = new Set(PATH.map(([c,r]) => `${c},${r}`));

const TOWER_TYPES = {
  archer: {
    name: "Ranger",
    icon: "🏹",
    cost: 30,
    damage: 12,
    range: 2.8,
    speed: 900,
    color: "#4ade80",
    desc: "Fast attacks, good range",
    upgrades: [
      { cost: 40, damage: 18, range: 3.2 },
      { cost: 80, damage: 28, range: 3.6 },
    ],
  },
  mage: {
    name: "Sorcerer",
    icon: "🔮",
    cost: 50,
    damage: 25,
    range: 2.2,
    speed: 1400,
    color: "#a78bfa",
    desc: "High damage, splash",
    upgrades: [
      { cost: 60, damage: 38, range: 2.5 },
      { cost: 100, damage: 55, range: 2.8 },
    ],
  },
  knight: {
    name: "Paladin",
    icon: "⚔️",
    cost: 40,
    damage: 18,
    range: 1.5,
    speed: 1100,
    color: "#f59e0b",
    desc: "Balanced, slows enemies",
    upgrades: [
      { cost: 50, damage: 28, range: 1.8 },
      { cost: 90, damage: 42, range: 2.0 },
    ],
  },
  druid: {
    name: "Druid",
    icon: "🌿",
    cost: 60,
    damage: 8,
    range: 2.5,
    speed: 2000,
    color: "#34d399",
    desc: "Heals nearby towers, poisons",
    upgrades: [
      { cost: 70, damage: 14, range: 2.8 },
      { cost: 110, damage: 22, range: 3.0 },
    ],
  },
};

const ENEMY_WAVES = [
  { enemies: [{ type: "goblin", count: 6 }], reward: 15 },
  { enemies: [{ type: "goblin", count: 8 }, { type: "orc", count: 2 }], reward: 20 },
  { enemies: [{ type: "orc", count: 6 }, { type: "goblin", count: 4 }], reward: 25 },
  { enemies: [{ type: "skeleton", count: 8 }, { type: "orc", count: 3 }], reward: 30 },
  { enemies: [{ type: "darkElf", count: 5 }, { type: "skeleton", count: 6 }], reward: 35 },
  { enemies: [{ type: "troll", count: 3 }, { type: "darkElf", count: 5 }], reward: 40 },
  { enemies: [{ type: "troll", count: 5 }, { type: "orc", count: 6 }], reward: 45 },
  { enemies: [{ type: "dragon", count: 1 }, { type: "troll", count: 4 }], reward: 60 },
  { enemies: [{ type: "dragon", count: 2 }, { type: "darkElf", count: 8 }], reward: 75 },
  { enemies: [{ type: "dragon", count: 3 }, { type: "troll", count: 5 }, { type: "skeleton", count: 10 }], reward: 100 },
];

const ENEMY_TYPES = {
  goblin:   { hp: 40,  speed: 2.5, icon: "👺", reward: 5,  name: "Goblin" },
  orc:      { hp: 90,  speed: 1.8, icon: "👹", reward: 8,  name: "Orc" },
  skeleton: { hp: 60,  speed: 3.0, icon: "💀", reward: 7,  name: "Skeleton" },
  darkElf:  { hp: 70,  speed: 3.5, icon: "🧝", reward: 10, name: "Dark Elf" },
  troll:    { hp: 200, speed: 1.2, icon: "🧌", reward: 15, name: "Troll" },
  dragon:   { hp: 500, speed: 1.0, icon: "🐉", reward: 40, name: "Dragon" },
};

let nextId = 1;

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default function TowerDefenseRPG() {
  const [screen, setScreen] = useState("menu");
  const [gold, setGold] = useState(120);
  const [lives, setLives] = useState(20);
  const [wave, setWave] = useState(0);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [towers, setTowers] = useState([]);
  const [enemies, setEnemies] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [selectedTower, setSelectedTower] = useState(null);
  const [placingTower, setPlacingTower] = useState(null);
  const [waveActive, setWaveActive] = useState(false);
  const [enemyQueue, setEnemyQueue] = useState([]);
  const [spawnTimer, setSpawnTimer] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [selectedPlacedTower, setSelectedPlacedTower] = useState(null);
  const [heroAbilityCooldown, setHeroAbilityCooldown] = useState(0);
  const [heroAbilityActive, setHeroAbilityActive] = useState(false);
  const gameRef = useRef(null);
  const stateRef = useRef({});

  stateRef.current = {
    gold, lives, wave, xp, level, towers, enemies, projectiles,
    floatingTexts, waveActive, enemyQueue, spawnTimer, gameOver,
    victory, heroAbilityCooldown, heroAbilityActive,
  };

  const addFloatingText = useCallback((x, y, text, color) => {
    setFloatingTexts(prev => [...prev, { id: nextId++, x, y, text, color, life: 40 }]);
  }, []);

  const startWave = useCallback(() => {
    const s = stateRef.current;
    if (s.waveActive || s.gameOver || s.victory) return;
    if (s.wave >= ENEMY_WAVES.length) {
      setVictory(true);
      return;
    }
    const waveData = ENEMY_WAVES[s.wave];
    const queue = [];
    for (const group of waveData.enemies) {
      const base = ENEMY_TYPES[group.type];
      const waveScale = 1 + s.wave * 0.12;
      for (let i = 0; i < group.count; i++) {
        queue.push({
          id: nextId++,
          type: group.type,
          hp: Math.floor(base.hp * waveScale),
          maxHp: Math.floor(base.hp * waveScale),
          speed: base.speed,
          icon: base.icon,
          reward: base.reward,
          pathIndex: 0,
          pathProgress: 0,
          x: PATH[0][0],
          y: PATH[0][1],
          slow: 0,
          poisoned: 0,
        });
      }
    }
    setEnemyQueue(queue);
    setSpawnTimer(0);
    setWaveActive(true);
  }, []);

  const placeTower = useCallback((col, row) => {
    const s = stateRef.current;
    if (!s.placingTower) return;
    if (pathSet.has(`${col},${row}`)) return;
    if (s.towers.some(t => t.col === col && t.row === row)) return;
    const type = TOWER_TYPES[s.placingTower];
    if (s.gold < type.cost) return;

    setTowers(prev => [...prev, {
      id: nextId++,
      type: s.placingTower,
      col, row,
      level: 0,
      lastFire: 0,
      kills: 0,
    }]);
    setGold(prev => prev - type.cost);
    setPlacingTower(null);
  }, []);

  const upgradeTower = useCallback((towerId) => {
    const s = stateRef.current;
    const tower = s.towers.find(t => t.id === towerId);
    if (!tower) return;
    const type = TOWER_TYPES[tower.type];
    if (tower.level >= type.upgrades.length) return;
    const upgrade = type.upgrades[tower.level];
    if (s.gold < upgrade.cost) return;

    setTowers(prev => prev.map(t =>
      t.id === towerId ? { ...t, level: t.level + 1 } : t
    ));
    setGold(prev => prev - upgrade.cost);
  }, []);

  const sellTower = useCallback((towerId) => {
    const s = stateRef.current;
    const tower = s.towers.find(t => t.id === towerId);
    if (!tower) return;
    const type = TOWER_TYPES[tower.type];
    let totalCost = type.cost;
    for (let i = 0; i < tower.level; i++) {
      totalCost += type.upgrades[i].cost;
    }
    setGold(prev => prev + Math.floor(totalCost * 0.6));
    setTowers(prev => prev.filter(t => t.id !== towerId));
    setSelectedPlacedTower(null);
  }, []);

  const useHeroAbility = useCallback(() => {
    const s = stateRef.current;
    if (s.heroAbilityCooldown > 0 || !s.waveActive) return;
    setHeroAbilityActive(true);
    setHeroAbilityCooldown(600);
    setEnemies(prev => prev.map(e => ({
      ...e,
      hp: e.hp - Math.floor(30 + s.level * 10),
      slow: Math.max(e.slow, 120),
    })));
    addFloatingText(5 * CELL_SIZE, 7 * CELL_SIZE, "⚡ THUNDER!", "#fbbf24");
    setTimeout(() => setHeroAbilityActive(false), 500);
  }, [addFloatingText]);

  // Main game loop
  useEffect(() => {
    if (screen !== "game") return;
    let frame = 0;

    const loop = setInterval(() => {
      frame++;
      const s = stateRef.current;
      if (s.gameOver || s.victory) return;

      // Spawn enemies
      if (s.waveActive && s.enemyQueue.length > 0) {
        if (s.spawnTimer <= 0) {
          const [next, ...rest] = s.enemyQueue;
          setEnemies(prev => [...prev, next]);
          setEnemyQueue(rest);
          setSpawnTimer(25);
        } else {
          setSpawnTimer(prev => prev - 1);
        }
      }

      // Move enemies
      setEnemies(prev => {
        let newLives = 0;
        const updated = prev.map(e => {
          const speed = e.slow > 0 ? e.speed * 0.5 : e.speed;
          let { pathIndex, pathProgress, x, y, slow, poisoned, hp } = e;
          if (poisoned > 0) {
            hp -= 1;
            poisoned--;
          }
          if (slow > 0) slow--;
          pathProgress += speed * 0.02;
          while (pathProgress >= 1 && pathIndex < PATH.length - 1) {
            pathProgress -= 1;
            pathIndex++;
          }
          if (pathIndex >= PATH.length - 1) {
            newLives++;
            return null;
          }
          const cur = PATH[pathIndex];
          const next = PATH[Math.min(pathIndex + 1, PATH.length - 1)];
          x = lerp(cur[0], next[0], Math.min(pathProgress, 1));
          y = lerp(cur[1], next[1], Math.min(pathProgress, 1));
          if (hp <= 0) return null;
          return { ...e, pathIndex, pathProgress, x, y, slow, poisoned, hp };
        }).filter(Boolean);

        if (newLives > 0) {
          setLives(l => {
            const newL = l - newLives;
            if (newL <= 0) setGameOver(true);
            return Math.max(0, newL);
          });
        }
        return updated;
      });

      // Tower attacks
      setTowers(prev => {
        const now = frame;
        return prev.map(tower => {
          const type = TOWER_TYPES[tower.type];
          const stats = tower.level > 0 ? type.upgrades[tower.level - 1] : type;
          const fireRate = type.speed / TICK_RATE;
          if (now - tower.lastFire < fireRate) return tower;

          const enemies = stateRef.current.enemies;
          const tx = tower.col;
          const ty = tower.row;
          const range = stats.range;

          let target = null;
          let bestProgress = -1;
          for (const e of enemies) {
            const d = dist(tx, ty, e.x, e.y);
            if (d <= range) {
              const progress = e.pathIndex + e.pathProgress;
              if (progress > bestProgress) {
                bestProgress = progress;
                target = e;
              }
            }
          }

          if (target) {
            const isSplash = tower.type === "mage";
            const isSlowing = tower.type === "knight";
            const isPoison = tower.type === "druid";
            setProjectiles(prev => [...prev, {
              id: nextId++,
              x: tx * CELL_SIZE + CELL_SIZE / 2,
              y: ty * CELL_SIZE + CELL_SIZE / 2,
              targetId: target.id,
              damage: stats.damage + (stateRef.current.heroAbilityActive ? 10 : 0),
              speed: 6,
              color: type.color,
              splash: isSplash,
              slow: isSlowing,
              poison: isPoison,
              towerId: tower.id,
            }]);
            return { ...tower, lastFire: now };
          }
          return tower;
        });
      });

      // Move projectiles
      setProjectiles(prev => {
        const enemies = stateRef.current.enemies;
        const remaining = [];
        for (const p of prev) {
          const target = enemies.find(e => e.id === p.targetId);
          if (!target) continue;
          const tx = target.x * CELL_SIZE + CELL_SIZE / 2;
          const ty = target.y * CELL_SIZE + CELL_SIZE / 2;
          const dx = tx - p.x;
          const dy = ty - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 8) {
            // Hit!
            setEnemies(prevE => {
              let killed = [];
              const updated = prevE.map(e => {
                let hit = false;
                if (e.id === target.id) hit = true;
                if (p.splash && dist(e.x, e.y, target.x, target.y) < 1.5) hit = true;
                if (!hit) return e;
                const newHp = e.hp - p.damage;
                const newSlow = p.slow ? Math.max(e.slow, 60) : e.slow;
                const newPoison = p.poison ? Math.max(e.poisoned, 100) : e.poisoned;
                if (newHp <= 0) {
                  killed.push(e);
                  return null;
                }
                return { ...e, hp: newHp, slow: newSlow, poisoned: newPoison };
              }).filter(Boolean);

              if (killed.length > 0) {
                let totalReward = 0;
                let totalXp = 0;
                for (const k of killed) {
                  totalReward += k.reward;
                  totalXp += k.reward;
                  addFloatingText(
                    k.x * CELL_SIZE + CELL_SIZE / 2,
                    k.y * CELL_SIZE,
                    `+${k.reward}g`,
                    "#fbbf24"
                  );
                }
                setGold(g => g + totalReward);
                setXp(x => {
                  const newXp = x + totalXp;
                  const xpNeeded = stateRef.current.level * 50;
                  if (newXp >= xpNeeded) {
                    setLevel(l => l + 1);
                    addFloatingText(5 * CELL_SIZE, 3 * CELL_SIZE, "LEVEL UP!", "#a78bfa");
                    return newXp - xpNeeded;
                  }
                  return newXp;
                });
                setTowers(prevT => prevT.map(t =>
                  t.id === p.towerId ? { ...t, kills: t.kills + killed.length } : t
                ));
              }
              return updated;
            });
          } else {
            const nx = p.x + (dx / d) * p.speed;
            const ny = p.y + (dy / d) * p.speed;
            remaining.push({ ...p, x: nx, y: ny });
          }
        }
        return remaining;
      });

      // Check wave complete
      if (s.waveActive && s.enemyQueue.length === 0 && s.enemies.length === 0) {
        const reward = ENEMY_WAVES[s.wave]?.reward || 0;
        setGold(g => g + reward);
        setWave(w => w + 1);
        setWaveActive(false);
        addFloatingText(5 * CELL_SIZE, 5 * CELL_SIZE, `+${reward}g bonus!`, "#4ade80");
        if (s.wave + 1 >= ENEMY_WAVES.length) {
          setVictory(true);
        }
      }

      // Floating texts
      setFloatingTexts(prev =>
        prev.map(ft => ({ ...ft, y: ft.y - 0.8, life: ft.life - 1 }))
          .filter(ft => ft.life > 0)
      );

      // Hero cooldown
      if (s.heroAbilityCooldown > 0) {
        setHeroAbilityCooldown(prev => Math.max(0, prev - 1));
      }

    }, 1000 / TICK_RATE);

    return () => clearInterval(loop);
  }, [screen, addFloatingText]);

  const resetGame = () => {
    setGold(120);
    setLives(20);
    setWave(0);
    setXp(0);
    setLevel(1);
    setTowers([]);
    setEnemies([]);
    setProjectiles([]);
    setFloatingTexts([]);
    setSelectedTower(null);
    setPlacingTower(null);
    setWaveActive(false);
    setEnemyQueue([]);
    setSpawnTimer(0);
    setGameOver(false);
    setVictory(false);
    setSelectedPlacedTower(null);
    setHeroAbilityCooldown(0);
    setHeroAbilityActive(false);
    setScreen("game");
  };

  // --- MENU ---
  if (screen === "menu") {
    return (
      <div style={{
        width: "100%", minHeight: "100vh",
        background: "linear-gradient(170deg, #0f0c29 0%, #1a1140 40%, #302b63 70%, #24243e 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        color: "#e2d9c8", overflow: "hidden", position: "relative",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.08,
          backgroundImage: "radial-gradient(circle at 20% 50%, #a78bfa 0%, transparent 50%), radial-gradient(circle at 80% 20%, #f59e0b 0%, transparent 40%)",
        }} />
        <div style={{ fontSize: 64, marginBottom: 8, filter: "drop-shadow(0 0 20px rgba(167,139,250,0.5))" }}>🏰</div>
        <h1 style={{
          fontSize: 32, fontWeight: 700, margin: "0 0 4px",
          background: "linear-gradient(135deg, #f5d485, #e2b04a, #f5d485)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          textShadow: "none", letterSpacing: 2,
        }}>
          REALM DEFENDERS
        </h1>
        <p style={{ fontSize: 13, color: "#8b7fb5", marginBottom: 32, letterSpacing: 3, textTransform: "uppercase" }}>
          Tower Defense RPG
        </p>
        <button onClick={() => setScreen("game")} style={{
          padding: "14px 48px", fontSize: 18, fontWeight: 700,
          background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
          border: "1px solid rgba(167,139,250,0.3)",
          borderRadius: 12, color: "#fff", cursor: "pointer",
          fontFamily: "inherit", letterSpacing: 1,
          boxShadow: "0 4px 24px rgba(124,58,237,0.4)",
          transition: "transform 0.15s",
        }}
        onMouseDown={e => e.currentTarget.style.transform = "scale(0.96)"}
        onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
        >
          Begin Quest
        </button>
        <div style={{ marginTop: 32, fontSize: 12, color: "#6b6190", maxWidth: 280, textAlign: "center", lineHeight: 1.6 }}>
          Place towers to defend the realm. Earn gold and XP to upgrade your forces. Survive 10 waves of fantasy foes.
        </div>
      </div>
    );
  }

  // --- GAME ---
  const gridW = GRID_COLS * CELL_SIZE;
  const gridH = GRID_ROWS * CELL_SIZE;
  const xpNeeded = level * 50;

  const selectedTowerStats = selectedPlacedTower ? (() => {
    const t = towers.find(tw => tw.id === selectedPlacedTower);
    if (!t) return null;
    const type = TOWER_TYPES[t.type];
    const stats = t.level > 0 ? type.upgrades[t.level - 1] : type;
    const nextUpgrade = t.level < type.upgrades.length ? type.upgrades[t.level] : null;
    return { tower: t, type, stats, nextUpgrade };
  })() : null;

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: "linear-gradient(180deg, #0f0c29, #1a1140)",
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
      color: "#e2d9c8", paddingBottom: 16, userSelect: "none",
    }}>
      {/* HUD */}
      <div style={{
        width: gridW, display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 4px", fontSize: 13, gap: 4, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span>💰 {gold}</span>
          <span>❤️ {lives}</span>
          <span>⚔️ Wave {wave + 1}/{ENEMY_WAVES.length}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#a78bfa" }}>Lv.{level}</span>
          <div style={{
            width: 60, height: 6, background: "#2a2450", borderRadius: 3, overflow: "hidden",
          }}>
            <div style={{
              width: `${(xp / xpNeeded) * 100}%`, height: "100%",
              background: "linear-gradient(90deg, #a78bfa, #7c3aed)", borderRadius: 3,
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div
        ref={gameRef}
        style={{
          width: gridW, height: gridH, position: "relative",
          background: "#1a2a1a",
          borderRadius: 8, overflow: "hidden",
          border: "1px solid #2a3a2a",
          boxShadow: "0 0 40px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const col = Math.floor((e.clientX - rect.left) / CELL_SIZE);
          const row = Math.floor((e.clientY - rect.top) / CELL_SIZE);
          if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

          if (placingTower) {
            placeTower(col, row);
          } else {
            const t = towers.find(tw => tw.col === col && tw.row === row);
            setSelectedPlacedTower(t ? t.id : null);
          }
        }}
      >
        {/* Grass texture */}
        {Array.from({ length: GRID_ROWS }).map((_, r) =>
          Array.from({ length: GRID_COLS }).map((_, c) => {
            const isPath = pathSet.has(`${c},${r}`);
            const brightness = ((c * 7 + r * 13) % 5) * 2;
            return (
              <div key={`${c},${r}`} style={{
                position: "absolute",
                left: c * CELL_SIZE, top: r * CELL_SIZE,
                width: CELL_SIZE, height: CELL_SIZE,
                background: isPath
                  ? `hsl(35, 30%, ${18 + brightness}%)`
                  : `hsl(120, 25%, ${14 + brightness}%)`,
                borderRight: "1px solid rgba(255,255,255,0.03)",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }} />
            );
          })
        )}

        {/* Path markers */}
        {PATH.map(([c, r], i) => (
          <div key={`path-${i}`} style={{
            position: "absolute",
            left: c * CELL_SIZE + CELL_SIZE / 2 - 2,
            top: r * CELL_SIZE + CELL_SIZE / 2 - 2,
            width: 4, height: 4, borderRadius: "50%",
            background: "rgba(210,180,120,0.15)",
          }} />
        ))}

        {/* Castle at end */}
        <div style={{
          position: "absolute",
          left: PATH[PATH.length - 1][0] * CELL_SIZE,
          top: PATH[PATH.length - 1][1] * CELL_SIZE,
          width: CELL_SIZE, height: CELL_SIZE,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>🏰</div>

        {/* Spawn point */}
        <div style={{
          position: "absolute",
          left: PATH[0][0] * CELL_SIZE,
          top: PATH[0][1] * CELL_SIZE,
          width: CELL_SIZE, height: CELL_SIZE,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, opacity: 0.5,
        }}>🌀</div>

        {/* Towers */}
        {towers.map(t => {
          const type = TOWER_TYPES[t.type];
          const stats = t.level > 0 ? type.upgrades[t.level - 1] : type;
          const isSelected = selectedPlacedTower === t.id;
          return (
            <div key={t.id}>
              {isSelected && (
                <div style={{
                  position: "absolute",
                  left: (t.col + 0.5) * CELL_SIZE - stats.range * CELL_SIZE,
                  top: (t.row + 0.5) * CELL_SIZE - stats.range * CELL_SIZE,
                  width: stats.range * CELL_SIZE * 2,
                  height: stats.range * CELL_SIZE * 2,
                  borderRadius: "50%",
                  border: `1px solid ${type.color}44`,
                  background: `${type.color}11`,
                  pointerEvents: "none",
                }} />
              )}
              <div style={{
                position: "absolute",
                left: t.col * CELL_SIZE, top: t.row * CELL_SIZE,
                width: CELL_SIZE, height: CELL_SIZE,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column",
                background: isSelected ? `${type.color}33` : `${type.color}18`,
                borderRadius: 6,
                border: isSelected ? `1px solid ${type.color}88` : "1px solid transparent",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{type.icon}</span>
                {t.level > 0 && (
                  <div style={{
                    position: "absolute", bottom: 1, right: 2,
                    fontSize: 8, color: type.color, fontWeight: 700,
                  }}>
                    {"★".repeat(t.level)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Enemies */}
        {enemies.map(e => {
          const px = e.x * CELL_SIZE + CELL_SIZE / 2;
          const py = e.y * CELL_SIZE + CELL_SIZE / 2;
          const hpPct = e.hp / e.maxHp;
          return (
            <div key={e.id} style={{ position: "absolute", left: px - 14, top: py - 18, pointerEvents: "none" }}>
              <div style={{
                width: 28, height: 3, background: "#333", borderRadius: 2, marginBottom: 2,
              }}>
                <div style={{
                  width: `${hpPct * 100}%`, height: "100%",
                  background: hpPct > 0.5 ? "#4ade80" : hpPct > 0.25 ? "#f59e0b" : "#ef4444",
                  borderRadius: 2, transition: "width 0.15s",
                }} />
              </div>
              <div style={{
                fontSize: 18, textAlign: "center", lineHeight: 1,
                filter: e.slow > 0 ? "brightness(1.5) hue-rotate(180deg)" : e.poisoned > 0 ? "hue-rotate(90deg)" : "none",
              }}>
                {e.icon}
              </div>
            </div>
          );
        })}

        {/* Projectiles */}
        {projectiles.map(p => (
          <div key={p.id} style={{
            position: "absolute",
            left: p.x - 3, top: p.y - 3,
            width: 6, height: 6, borderRadius: "50%",
            background: p.color,
            boxShadow: `0 0 6px ${p.color}`,
            pointerEvents: "none",
          }} />
        ))}

        {/* Floating texts */}
        {floatingTexts.map(ft => (
          <div key={ft.id} style={{
            position: "absolute",
            left: ft.x, top: ft.y,
            color: ft.color,
            fontSize: 12, fontWeight: 700,
            pointerEvents: "none",
            opacity: ft.life / 40,
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            transform: "translateX(-50%)",
          }}>
            {ft.text}
          </div>
        ))}

        {/* Hero ability flash */}
        {heroAbilityActive && (
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle, rgba(251,191,36,0.3), transparent)",
            pointerEvents: "none",
          }} />
        )}

        {/* Placing tower ghost */}
        {placingTower && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.15)",
            pointerEvents: "none",
            fontSize: 12, color: "#a78bfa",
          }}>
            Tap a green tile to place
          </div>
        )}
      </div>

      {/* Tower Info Panel */}
      {selectedTowerStats && (
        <div style={{
          width: gridW, marginTop: 8, padding: "10px 12px",
          background: "rgba(26,17,64,0.9)", borderRadius: 10,
          border: "1px solid #2a2450",
          display: "flex", gap: 10, alignItems: "center", fontSize: 12,
        }}>
          <div style={{ fontSize: 28 }}>{selectedTowerStats.type.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: selectedTowerStats.type.color, fontSize: 14 }}>
              {selectedTowerStats.type.name}
              {selectedTowerStats.tower.level > 0 && (
                <span style={{ color: "#f59e0b", marginLeft: 4 }}>
                  {"★".repeat(selectedTowerStats.tower.level)}
                </span>
              )}
            </div>
            <div style={{ color: "#8b7fb5" }}>
              DMG: {selectedTowerStats.stats.damage} | RNG: {selectedTowerStats.stats.range.toFixed(1)} | Kills: {selectedTowerStats.tower.kills}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {selectedTowerStats.nextUpgrade && (
              <button onClick={() => upgradeTower(selectedPlacedTower)} style={{
                padding: "6px 10px", fontSize: 11, fontWeight: 700,
                background: gold >= selectedTowerStats.nextUpgrade.cost
                  ? "linear-gradient(135deg, #a78bfa, #7c3aed)" : "#333",
                border: "none", borderRadius: 8, color: "#fff", cursor: "pointer",
                fontFamily: "inherit",
                opacity: gold >= selectedTowerStats.nextUpgrade.cost ? 1 : 0.4,
              }}>
                ⬆ {selectedTowerStats.nextUpgrade.cost}g
              </button>
            )}
            <button onClick={() => sellTower(selectedPlacedTower)} style={{
              padding: "6px 10px", fontSize: 11, fontWeight: 700,
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              border: "none", borderRadius: 8, color: "#fff", cursor: "pointer",
              fontFamily: "inherit",
            }}>
              Sell
            </button>
          </div>
        </div>
      )}

      {/* Tower Shop */}
      <div style={{
        width: gridW, marginTop: 8,
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
      }}>
        {Object.entries(TOWER_TYPES).map(([key, type]) => (
          <button key={key} onClick={() => {
            if (gold >= type.cost) {
              setPlacingTower(placingTower === key ? null : key);
              setSelectedPlacedTower(null);
            }
          }} style={{
            padding: "8px 4px", fontSize: 11,
            background: placingTower === key
              ? `${type.color}33`
              : "rgba(26,17,64,0.8)",
            border: placingTower === key
              ? `1px solid ${type.color}`
              : "1px solid #2a2450",
            borderRadius: 10, color: "#e2d9c8", cursor: "pointer",
            fontFamily: "inherit",
            opacity: gold >= type.cost ? 1 : 0.4,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
            <span style={{ fontSize: 22 }}>{type.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 10, color: type.color }}>{type.name}</span>
            <span style={{ fontSize: 10, color: "#8b7fb5" }}>{type.cost}g</span>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div style={{
        width: gridW, marginTop: 8,
        display: "flex", gap: 8,
      }}>
        <button onClick={startWave} disabled={waveActive} style={{
          flex: 1, padding: "12px 8px", fontSize: 14, fontWeight: 700,
          background: waveActive
            ? "#333"
            : "linear-gradient(135deg, #ef4444, #b91c1c)",
          border: "none", borderRadius: 10, color: "#fff", cursor: waveActive ? "default" : "pointer",
          fontFamily: "inherit", opacity: waveActive ? 0.5 : 1,
          boxShadow: waveActive ? "none" : "0 4px 16px rgba(239,68,68,0.3)",
        }}>
          {waveActive ? `Wave ${wave + 1} in progress...` : `Send Wave ${wave + 1}`}
        </button>
        <button onClick={useHeroAbility} style={{
          padding: "12px 16px", fontSize: 14, fontWeight: 700,
          background: heroAbilityCooldown > 0
            ? "#333"
            : "linear-gradient(135deg, #f59e0b, #d97706)",
          border: "none", borderRadius: 10, color: "#fff", cursor: heroAbilityCooldown > 0 ? "default" : "pointer",
          fontFamily: "inherit", opacity: heroAbilityCooldown > 0 ? 0.5 : 1,
          position: "relative", overflow: "hidden",
        }}>
          ⚡
          {heroAbilityCooldown > 0 && (
            <div style={{
              position: "absolute", bottom: 0, left: 0,
              width: `${(heroAbilityCooldown / 600) * 100}%`,
              height: 3, background: "#f59e0b",
            }} />
          )}
        </button>
      </div>

      {/* Game Over / Victory Overlay */}
      {(gameOver || victory) && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.85)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>
            {victory ? "👑" : "💀"}
          </div>
          <h2 style={{
            fontSize: 28, fontWeight: 700, margin: "0 0 8px",
            color: victory ? "#f5d485" : "#ef4444",
            fontFamily: "'Palatino Linotype', serif",
          }}>
            {victory ? "REALM SAVED!" : "REALM FALLEN"}
          </h2>
          <p style={{ color: "#8b7fb5", marginBottom: 8, fontSize: 14 }}>
            Reached wave {wave} of {ENEMY_WAVES.length}
          </p>
          <p style={{ color: "#8b7fb5", marginBottom: 24, fontSize: 13 }}>
            Hero Level {level} | Towers Built: {towers.length}
          </p>
          <button onClick={resetGame} style={{
            padding: "14px 48px", fontSize: 16, fontWeight: 700,
            background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
            border: "none", borderRadius: 12, color: "#fff", cursor: "pointer",
            fontFamily: "inherit", letterSpacing: 1,
          }}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
