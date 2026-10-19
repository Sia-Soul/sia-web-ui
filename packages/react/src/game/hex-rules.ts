import type { GameAbility, GameAbilityKind, GameBattle, GameBattleEvent, GameHexCell, GameHexCue, GameHexUnit, IdleGameDefinition, IdleGameState, GameCombatStats } from './types';

/** 框架默认能力；题材方可通过 definition.abilities 完整替换四个装配槽。 */
export const DEFAULT_GAME_ABILITIES: readonly GameAbility[] = [
    { id: 'bolt', name: '符箓', kind: 'attack', effect: 'damage', range: 2, scale: 1, cooldown: 1, description: '两格内单体攻击。' },
    { id: 'blade', name: '剑击', kind: 'attack', effect: 'damage', range: 1, scale: 1.3, cooldown: 1, description: '自动接近目标，一格内造成较高伤害。' },
    { id: 'thunder', name: '引雷', kind: 'skill', effect: 'damage', range: 3, scale: 1.8, cooldown: 3, description: '每三回合，三格内单体爆发。' },
    { id: 'flame', name: '火阵', kind: 'skill', effect: 'blast', range: 2, scale: 1.15, cooldown: 3, description: '每三回合，攻击目标及其周围一格敌人。' },
    { id: 'mend', name: '回春', kind: 'power', effect: 'heal', range: 1, scale: .12, cooldown: 5, description: '每五回合，恢复最大气血的 12%。' },
    { id: 'ward', name: '护体', kind: 'power', effect: 'shield', range: 1, scale: .4, cooldown: 5, description: '每五回合，本回合减伤 40%。' },
    { id: 'bell', name: '镇妖铃', kind: 'treasure', effect: 'blast', range: 3, scale: 1.5, cooldown: 8, description: '每八回合，震击目标周围一格敌人。' },
    { id: 'seal', name: '伏魔印', kind: 'treasure', effect: 'damage', range: 3, scale: 2.5, cooldown: 8, description: '每八回合，对一个目标造成强力伤害。' },
];
/** 获取可信能力表；未配置时返回框架默认表，只读使用。 */
export function gameAbilities(definition: IdleGameDefinition): readonly GameAbility[] { return definition.abilities ?? DEFAULT_GAME_ABILITIES; }
/** 两个轴向格子的最短六边形距离，返回非负整数，不含障碍绕行。 */
export function hexDistance(a: GameHexCell, b: GameHexCell): number { return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r)); }
/** 返回半径三格的 37 个可行走地块，每次调用创建独立数组。 */
export function gameHexCells(): GameHexCell[] {
    const cells: GameHexCell[] = [];
    for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) if (hexDistance({ q, r }, { q: 0, r: 0 }) <= 3) cells.push({ q, r });
    return cells;
}
const directions = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];
const key = (cell: GameHexCell) => `${cell.q},${cell.r}`;
const living = (unit: GameHexUnit) => unit.hp > 0;

// 广度优先寻路，只允许六个邻格且禁止重叠；每回合最多走一步，不能穿越占用格。
function advance(unit: GameHexUnit, target: GameHexCell, range: number, units: GameHexUnit[], cues: GameHexCue[], at: number) {
    if (hexDistance(unit, target) <= range) return;
    const blocked = new Set(units.filter(u => u.id !== unit.id && living(u)).map(key));
    const queue = [{ cell: { q: unit.q, r: unit.r }, first: null as GameHexCell | null }], seen = new Set([key(unit)]);
    while (queue.length) {
        const current = queue.shift()!;
        if (current.first && hexDistance(current.cell, target) <= range) {
            const from = { q: unit.q, r: unit.r };
            unit.q = current.first.q; unit.r = current.first.r;
            cues.push({ at, kind: 'move', actor: unit.id, from, to: { ...current.first } });
            return;
        }
        for (const d of directions) {
            const cell = { q: current.cell.q + d.q, r: current.cell.r + d.r }, id = key(cell);
            if (hexDistance(cell, { q: 0, r: 0 }) > 3 || blocked.has(id) || seen.has(id)) continue;
            seen.add(id); queue.push({ cell, first: current.first ?? cell });
        }
    }
}

// 小怪从环形边缘错开生成；首领使用全新的 units 数组，旧敌人不会带入挑战。
export function spawnHexEnemy(fight: GameBattle, hp: number, seed: number): GameHexUnit | undefined {
    const edge = gameHexCells().filter(c => hexDistance(c, { q: 0, r: 0 }) === 3).sort((a, b) => Math.atan2(a.r + a.q / 2, a.q) - Math.atan2(b.r + b.q / 2, b.q));
    const start = ((seed + fight.spawned * 5) % edge.length + edge.length) % edge.length;
    const cell = edge.slice(start).concat(edge.slice(0, start)).find(c => !fight.units.some(u => living(u) && key(u) === key(c)));
    if (!cell) return undefined;
    const enemy: GameHexUnit = { ...cell, id: `enemy-${fight.spawned++}`, side: 'enemy', hp, maxHp: hp };
    fight.units.push(enemy);
    return enemy;
}

// 只结算战术与气血，经济奖励由主引擎按死亡单位逐个入账，避免重复发放。
export function resolveHexRound(definition: IdleGameDefinition, state: IdleGameState, stats: GameCombatStats, rng: () => number): GameBattleEvent {
    const f = state.fight!, map = definition.maps[state.map], pet = definition.pets.find(p => p.id === state.pet)!;
    const hero = f.units.find(u => u.id === 'hero')!, companion = f.units.find(u => u.id === 'pet')!;
    const cues: GameHexCue[] = [], before = f.units.filter(living).map(u => ({ ...u }));
    // 测试和宿主可在开战后调整气血；以公开战斗属性为准同步到棋子。
    hero.hp = f.hp; hero.maxHp = f.maxHp;
    const beforeHero = before.find(u => u.id === 'hero'); if (beforeHero) beforeHero.hp = f.hp;
    f.turn++;
    if (!f.boss && f.spawned < 4 && f.turn % 2 === 1) {
        const unit = spawnHexEnemy(f, map.hp, state.kills * 3);
        if (unit) { before.push({ ...unit }); cues.push({ at: .02, kind: 'spawn', actor: unit.id, label: '妖气来袭' }); }
    }
    const enemies = () => f.units.filter(u => u.side === 'enemy' && living(u));
    const target = enemies().sort((a, b) => hexDistance(hero, a) - hexDistance(hero, b) || a.hp - b.hp)[0];
    const cycle = f.turn % 5, move = !f.boss || cycle === 1 || cycle === 2 ? 'strike' : cycle === 3 ? 'charge' : cycle === 4 ? 'heavy' : 'recover';
    const playback: NonNullable<GameBattleEvent['playback']> = { units: before, cues, turn: f.turn, boss: f.boss, move, heroBefore: hero.hp, heroAfterImpact: hero.hp, heroAfter: hero.hp, enemyBefore: target?.hp ?? 0, enemyAfterHero: target?.hp ?? 0, enemyAfter: target?.hp ?? 0, healed: 0, guarded: pet.effect === 'guard', won: false, xp: 0, gold: 0 };
    const event: GameBattleEvent = { damage: 0, petDamage: 0, crit: rng() < .13, skill: false, incoming: 0, playback };
    const abilities = gameAbilities(definition), equipped = (kind: GameAbilityKind) => abilities.find(a => a.id === state.loadout[kind]) ?? abilities.find(a => a.kind === kind)!;
    const attack = equipped('attack'), skill = equipped('skill'), power = equipped('power'), treasure = equipped('treasure');
    const offensive = f.turn % treasure.cooldown === 0 ? treasure : f.turn % skill.cooldown === 0 ? skill : attack;
    event.skill = offensive.kind !== 'attack';
    if (target) {
        advance(hero, target, offensive.range, f.units, cues, .04);
        if (hexDistance(hero, target) <= offensive.range) {
            cues.push({ at: .18, kind: 'cast', actor: 'hero', target: target.id, label: offensive.name });
            const victims = offensive.effect === 'blast' ? enemies().filter(u => hexDistance(target, u) <= 1) : [target];
            for (const enemy of victims) {
                const damage = Math.round(stats.atk * offensive.scale * (event.crit ? 1.5 : 1));
                enemy.hp = Math.max(0, enemy.hp - damage); event.damage += damage;
                cues.push({ at: .35, kind: 'hit', actor: 'hero', target: enemy.id, value: damage, hp: enemy.hp, label: event.crit ? '暴击' : offensive.name });
            }
        }
        playback.enemyAfterHero = target.hp;
    }
    let shield = pet.effect === 'guard' ? .25 : 0;
    if (f.turn % power.cooldown === 0 && power.effect === 'shield') {
        shield = Math.max(shield, power.scale);
        cues.push({ at: .40, kind: 'shield', actor: 'hero', target: 'hero', label: power.name });
    }
    const petTarget = enemies().sort((a, b) => hexDistance(companion, a) - hexDistance(companion, b))[0];
    advance(companion, pet.effect === 'attack' && petTarget ? petTarget : hero, pet.effect === 'attack' ? 2 : 1, f.units, cues, .40);
    if (pet.effect === 'attack' && petTarget && hexDistance(companion, petTarget) <= 2) {
        const damage = pet.base + ((state.pets[state.pet] || 1) - 1) * 3;
        petTarget.hp = Math.max(0, petTarget.hp - damage); event.petDamage = damage;
        cues.push({ at: .44, kind: 'cast', actor: 'pet', target: petTarget.id, label: '灵宠追击' });
        cues.push({ at: .53, kind: 'hit', actor: 'pet', target: petTarget.id, value: damage, hp: petTarget.hp });
    }
    // 敌人分别寻路到主角邻格，只有邻接才允许攻击，不会隔空造成伤害。
    enemies().forEach((enemy, i) => {
        advance(enemy, hero, 1, f.units, cues, .43);
        if (hero.hp <= 0 || hexDistance(enemy, hero) > 1 || move === 'charge' || move === 'recover') return;
        const damage = Math.max(1, Math.round(((f.boss ? map.bossAtk : map.atk) * (move === 'heavy' ? 2 : 1) - stats.def) * (1 - shield)));
        cues.push({ at: .57 + i * .035, kind: 'cast', actor: enemy.id, target: 'hero', label: move === 'heavy' ? map.bossSkillName ?? '蓄力重击' : '近身攻击' });
        hero.hp = Math.max(0, hero.hp - damage); event.incoming += damage;
        cues.push({ at: .63 + i * .035, kind: 'hit', actor: enemy.id, target: 'hero', value: damage, hp: hero.hp });
    });
    playback.heroAfterImpact = hero.hp;
    // 治疗在受击后发生，展示实际恢复量，不允许死者复生或满血虚假跳字。
    if (hero.hp > 0) {
        const amount = pet.effect === 'heal' ? 7 + (state.pets[state.pet] || 1) * 3 : 0;
        const heal = Math.min(hero.maxHp - hero.hp, amount);
        if (heal > 0) { hero.hp += heal; playback.healed += heal; cues.push({ at: .79, kind: 'heal', actor: 'pet', target: 'hero', value: heal, hp: hero.hp, label: '月华凝露' }); }
        if (f.turn % power.cooldown === 0 && power.effect === 'heal') {
            const value = Math.min(hero.maxHp - hero.hp, Math.round(hero.maxHp * power.scale));
            hero.hp += value; playback.healed += value;
            cues.push({ at: .82, kind: 'heal', actor: 'hero', target: 'hero', value, hp: hero.hp, label: power.name });
        }
    }
    for (const unit of f.units) if (unit.hp === 0 && before.some(u => u.id === unit.id && u.hp > 0)) cues.push({ at: .84, kind: 'death', actor: unit.id });
    playback.heroAfter = hero.hp; playback.enemyAfter = target?.hp ?? 0;
    f.hp = hero.hp;
    f.enemyHp = enemies().reduce((total, u) => total + u.hp, 0);
    f.enemyMax = f.units.filter(u => u.side === 'enemy').reduce((total, u) => total + u.maxHp, 0);
    if (hero.hp === 0 || f.turn >= 60) { f.status = 'lost'; event.lost = true; }
    else if (!enemies().length && (f.boss || f.spawned >= 4)) { f.status = 'won'; playback.won = true; }
    cues.sort((a, b) => a.at - b.at);
    return event;
}
