import { gameAbilities, resolveHexRound, spawnHexEnemy } from './hex-rules';
import type { IdleGameDefinition, IdleGameState, IdleEngine, GameEquipment, GameBattleEvent, GameOfflineReport } from './types';
/**
 * 根据题材配置创建独立的挂机规则引擎；多个引擎互不共享角色状态。
 * @param definition 可信配置，至少一个地图、伙伴和装备部位；章节 id 连续，品质至少三档。
 * @returns 同步规则句柄，可用于浏览器、测试或其他 React 宿主。
 * @throws 配置缺少关联项或数值无效时抛出 Error，不创建部分可用的引擎。
 */
export function createIdleEngine(definition: IdleGameDefinition): IdleEngine {
    const MAPS = definition.maps, PETS = definition.pets, slots = definition.slots, RARITIES = definition.rarities;
    const slotKeys = Object.keys(slots), SLOTS = Object.fromEntries(slotKeys.map(key => [key, slots[key].name]));
    const positive = (value: number) => Number.isFinite(value) && value > 0;
    if (!MAPS.length || !PETS.length || !slotKeys.length || RARITIES.length < 3 ||
        new Set(PETS.map(p => p.id)).size !== PETS.length ||
        MAPS.some((m, i) => m.id !== i || !slots[m.rewardSlot] || !positive(m.hp) || !positive(m.bossHp) || [m.atk, m.bossAtk, m.xp, m.gold].some(n => !Number.isFinite(n) || n < 0)) ||
        PETS.some(p => !p.id || !Number.isFinite(p.cost) || p.cost < 0 || !Number.isFinite(p.base) || p.base < 0) ||
        slotKeys.some(k => slots[k].names.length !== RARITIES.length || Object.values(slots[k].base).some(n => !Number.isFinite(n) || n < 0)) ||
        (definition.turnDurationMs !== undefined && (!Number.isInteger(definition.turnDurationMs) || definition.turnDurationMs < 1000 || definition.turnDurationMs > 5000)) ||
        (definition.offlineCapSeconds !== undefined && (!Number.isInteger(definition.offlineCapSeconds) || definition.offlineCapSeconds < 0 || definition.offlineCapSeconds > 43200)))
        throw new Error('游戏内容配置不正确');
    // 四类能力都需要有可用项，防止导入配置后自动战斗找不到回退能力。
    const abilities = gameAbilities(definition);
    if (new Set(abilities.map(a => a.id)).size !== abilities.length || ['attack', 'skill', 'power', 'treasure'].some(kind => !abilities.some(a => a.kind === kind)) || abilities.some(a => !a.id || !['attack','skill','power','treasure'].includes(a.kind) || !['damage','blast','heal','shield'].includes(a.effect) || !Number.isInteger(a.range) || a.range < 1 || a.range > 3 || !Number.isFinite(a.scale) || a.scale <= 0 || (a.effect === 'shield' && a.scale > .8) || (a.kind === 'power' ? !['heal','shield'].includes(a.effect) : !['damage','blast'].includes(a.effect)) || !Number.isInteger(a.cooldown) || (a.kind === 'attack' ? a.cooldown !== 1 : a.cooldown < 2))) throw new Error('自动战斗能力配置不正确');
    const busy = (s: IdleGameState) => Boolean(s.fight?.boss && s.fight.status === 'active');
    const copy = (value: IdleGameState): IdleGameState => JSON.parse(JSON.stringify(value));
    function makeGear(slot: string, tier = 0, rank = 0, id: string | number = Date.now()): GameEquipment {
        const scale = (1 + tier * .75) * (1 + rank * .45);
        return { id: String(id), slot, tier, rank, name: slots[slot].names[tier], atk: Math.round(slots[slot].base.atk * scale), def: Math.round(slots[slot].base.def * scale), hp: Math.round(slots[slot].base.hp * scale), locked: false };
    }
    function freshState(now = Date.now()): IdleGameState {
        return { version: 1, name: definition.heroName, level: 1, xp: 0, gold: 120, essence: 30, material: 0, map: 0, unlocked: 0, cleared: [], idle: false, kills: 0, bossWins: 0, inventory: [], equipment: Object.fromEntries(slotKeys.map(key => [key, slots[key].starter ? makeGear(key, 0, 0, `starter-${key}`) : null])), upgrades: Object.fromEntries(slotKeys.map(key => [key, 0])), pet: PETS[0].id, pets: { [PETS[0].id]: 1 }, nextId: 1, savedAt: now, sessionGold: 0, sessionXp: 0, sessionDrops: 0, logs: [], fight: null, loadout: Object.fromEntries(['attack','skill','power','treasure'].map(kind => [kind, abilities.find(a => a.kind === kind)!.id])) as IdleGameState['loadout'] };
    }
    const xpNeeded = (s: IdleGameState) => 50 + s.level * 30;
    function stats(s: IdleGameState) {
        const result = { power: 0, atk: 16 + (s.level - 1) * 4, def: 3 + (s.level - 1) * 2, hp: 165 + (s.level - 1) * 23 };
        for (const [slot, item] of Object.entries(s.equipment))
            if (item) {
                const multiplier = 1 + s.upgrades[slot] * .16;
                for (const key of (['atk', 'def', 'hp'] as const))
                    result[key] += Math.round(item[key] * multiplier);
            }
        result.power = result.atk * 5 + result.def * 3 + Math.round(result.hp / 5) + (s.pets[s.pet] || 0) * 18;
        return result;
    }
    function addLog(s: IdleGameState, text: string, type = 'info') {
        s.logs.unshift({ text, type, time: Date.now() });
        s.logs = s.logs.slice(0, 60);
    }
    // 背包满时将新掉落转成锻材，避免长时间挂机导致存档无限增长。
    function addDrop(s: IdleGameState, item: GameEquipment) {
        s.sessionDrops++;
        if (s.inventory.length >= 80) {
            s.material += 2 + item.tier * 2;
            return false;
        }
        s.inventory.push(item);
        return true;
    }
    function grant(s: IdleGameState, xp: number, gold: number) {
        s.xp += xp;
        s.gold += gold;
        s.sessionGold += gold;
        s.sessionXp += xp;
        while (s.xp >= xpNeeded(s) && s.level < 60) {
            s.xp -= xpNeeded(s);
            s.level++;
            addLog(s, `境界精进，升至 ${s.level} 级！`, 'rare');
        }
    }
    // 挑战首领直接替换整个棋盘，明确清除场上普通敌人。
    function beginFight(s: IdleGameState, boss = false) {
        if (boss && busy(s)) return;
        const m = MAPS[s.map], st = stats(s);
        s.fight = { boss, hp: st.hp, maxHp: st.hp, enemyHp: 0, enemyMax: 0, turn: 0, status: 'active', recovery: 0, spawned: 0,
            units: [{ id:'hero', side:'hero', q:0, r:0, hp:st.hp, maxHp:st.hp }, { id:'pet', side:'pet', q:-1, r:1, hp:1, maxHp:1 }] };
        for (let i=0;i<(boss ? 1 : 2);i++) spawnHexEnemy(s.fight, boss ? m.bossHp : m.hp, s.kills * 3);
        s.fight.enemyHp = s.fight.enemyMax = (boss ? m.bossHp : m.hp * 2);
        if (boss) addLog(s, `场上小妖已清退，${m.boss}进入棋盘。`, 'boss');
    }
    // 规则结算与播放快照分离；每个死亡敌人的奖励只在本回合发放一次。
    function tick(s: IdleGameState, rng = Math.random): GameBattleEvent | null {
        if (!s.idle && !s.fight?.boss) return null;
        if (!s.fight) beginFight(s);
        let f = s.fight!;
        if (f.status !== 'active') {
            if (++f.recovery < 2) return null;
            if (!s.idle) { s.fight = null; return null; }
            beginFight(s); f = s.fight!;
        }
        const m = MAPS[s.map], event = resolveHexRound(definition, s, stats(s), rng), playback = event.playback!;
        const dead = playback.cues.filter(c => c.kind === 'death' && c.actor.startsWith('enemy-'));
        for (const cue of dead) {
            s.kills++;
            let xp = m.xp, gold = m.gold, drop = '';
            if (f.boss) {
                s.bossWins++;
                const first = !s.cleared.includes(s.map);
                xp *= first ? 6 : 2; gold *= first ? 8 : 3;
                s.essence += first ? 50 : 12;
                if (first) {
                    s.cleared.push(s.map);
                    s.unlocked = Math.min(MAPS.length - 1, Math.max(s.unlocked, s.map + 1));
                    const item = makeGear(m.rewardSlot, 1, s.map, `drop-${s.nextId++}`);
                    addDrop(s, item); event.reward = drop = item.name;
                    addLog(s, `首通 ${m.boss}！获得 ${item.name}。`, 'rare');
                } else addLog(s, `再次击败 ${m.boss}，获得修行奖励。`, 'rare');
                event.bossWin = true; event.first = first;
            } else {
                s.essence += 2;
                if (rng() < .38) {
                    const item = makeGear(slotKeys[Math.min(slotKeys.length - 1, Math.floor(rng() * slotKeys.length))], rng() < .12 ? 2 : rng() < .45 ? 1 : 0, s.map, `drop-${s.nextId++}`);
                    const kept = addDrop(s, item); event.drop = drop = item.name;
                    addLog(s, kept ? `拾得 ${RARITIES[item.tier]} · ${item.name}` : '背包已满，新掉落已转为锻材。', 'loot');
                }
            }
            grant(s, xp, gold); playback.xp += xp; playback.gold += gold;
            playback.cues.push({ at:.90, kind:'loot', actor:cue.actor, value:gold, label:drop || `经验 +${xp}` });
        }
        if (event.lost) addLog(s, '历练失利，休整后再战；可更换能力、装备或灵宠。', 'boss');
        return event;
    }
    function equip(s: IdleGameState, id: string) {
        if (busy(s))
            return false;
        const index = s.inventory.findIndex(i => i.id === id);
        if (index < 0)
            return false;
        const item = s.inventory.splice(index, 1)[0], old = s.equipment[item.slot];
        if (old)
            s.inventory.push(old);
        s.equipment[item.slot] = item;
        addLog(s, `装备了 ${item.name}。`, 'loot');
        return true;
    }
    const upgradeCost = (s: IdleGameState, slot: string) => 45 + s.upgrades[slot] * 35;
    function upgrade(s: IdleGameState, slot: string) {
        if (busy(s))
            return false;
        if (!s.equipment[slot] || s.upgrades[slot] >= 10 || s.gold < upgradeCost(s, slot))
            return false;
        s.gold -= upgradeCost(s, slot);
        s.upgrades[slot]++;
        return true;
    }
    function dismantle(s: IdleGameState, id: string) {
        if (busy(s))
            return false;
        const index = s.inventory.findIndex(i => i.id === id && !i.locked);
        if (index < 0)
            return false;
        const [item] = s.inventory.splice(index, 1);
        s.material += 2 + item.tier * 2;
        return true;
    }
    function forge(s: IdleGameState) {
        if (busy(s))
            return false;
        if (s.material < 12)
            return false;
        s.material -= 12;
        const slots = Object.keys(SLOTS), slot = slots[(s.nextId - 1) % slotKeys.length];
        addDrop(s, makeGear(slot, 2, s.map, `drop-${s.nextId++}`));
        return true;
    }
    function trainPet(s: IdleGameState, id: string) {
        if (busy(s))
            return false;
        const level = s.pets[id];
        if (!level || level >= 20)
            return false;
        const cost = level * 15;
        if (s.essence < cost)
            return false;
        s.essence -= cost;
        s.pets[id]++;
        return true;
    }
    function unlockPet(s: IdleGameState, id: string) {
        if (busy(s))
            return false;
        const pet = PETS.find(p => p.id === id);
        if (!pet || s.pets[id] || s.essence < pet.cost)
            return false;
        s.essence -= pet.cost;
        s.pets[id] = 1;
        return true;
    }
    // 导入数据只接收已知字段，并限制数值与对象形状，防止损坏存档影响页面。
    function hydrate(input: unknown, now = Date.now()): IdleGameState {
        if (!input || typeof input !== "object")
            throw new Error("存档格式不正确");
        const raw = input as IdleGameState;
        if (!raw || raw.version !== 1 || !Array.isArray(raw.inventory) || !raw.equipment || !raw.pets)
            throw new Error('存档格式不正确');
        const s = freshState(now), number = (v: unknown, min: number, max: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min;
        for (const key of (['gold', 'xp', 'essence', 'material', 'kills', 'bossWins', 'sessionGold', 'sessionXp', 'sessionDrops'] as const))
            s[key] = number(raw[key], 0, 1e9);
        s.level = number(raw.level, 1, 60);
        s.unlocked = number(raw.unlocked, 0, MAPS.length - 1);
        s.map = number(raw.map, 0, s.unlocked);
        s.nextId = number(raw.nextId, 1, 1e9);
        s.savedAt = number(raw.savedAt, 0, now);
        s.idle = raw.idle === true;
        s.cleared = [...new Set((Array.isArray(raw.cleared) ? raw.cleared : []).filter(v => Number.isInteger(v) && v >= 0 && v < MAPS.length))];
        const validItem = (item: GameEquipment | null): item is GameEquipment => !!item && typeof item.id === 'string' && item.id.length < 80 && /^[a-zA-Z0-9_-]+$/.test(item.id) && Object.hasOwn(SLOTS, item.slot) && Number.isInteger(item.tier) && item.tier >= 0 && item.tier < RARITIES.length;
        const cleanItem = (item: GameEquipment) => ({ ...makeGear(item.slot, item.tier, number(item.rank, 0, MAPS.length - 1), item.id), locked: item.locked === true });
        s.inventory = raw.inventory.slice(0, 80).filter(validItem).map(cleanItem);
        for (const slot of Object.keys(SLOTS)) {
            s.equipment[slot] = validItem(raw.equipment[slot]) && raw.equipment[slot].slot === slot ? cleanItem(raw.equipment[slot]) : null;
            s.upgrades[slot] = number(raw.upgrades?.[slot], 0, 10);
        }
        for (const pet of PETS)
            if (raw.pets[pet.id])
                s.pets[pet.id] = number(raw.pets[pet.id], 1, 20);
        s.pet = Object.hasOwn(s.pets, raw.pet) ? raw.pet : PETS[0].id;
        for (const kind of (['attack','skill','power','treasure'] as const)) {
            const chosen = abilities.find(a => a.id === raw.loadout?.[kind] && a.kind === kind);
            if (chosen) s.loadout[kind] = chosen.id;
        }
        return s;
    }
    // 离线最多模拟 12 小时，仅进行普通战斗；使用与在线相同的伤害和掉落规则。
    function settleOffline(s: IdleGameState, now = Date.now(), rng = Math.random): GameOfflineReport | null {
        const seconds = Math.min(definition.offlineCapSeconds ?? 43200, Math.max(0, Math.floor((now - s.savedAt) / 1000)));
        if (!s.idle || seconds < 15) {
            s.savedAt = now;
            return null;
        }
        const before = { xp: s.sessionXp, gold: s.gold, drops: s.sessionDrops, essence: s.essence, kills: s.kills };
        s.fight = null;
        for (let i = 0; i < Math.floor(seconds * 1000 / (definition.turnDurationMs ?? 1000)); i++)
            tick(s, rng);
        s.fight = null;
        s.savedAt = now;
        return { seconds, xp: s.sessionXp - before.xp, gold: s.gold - before.gold, drops: s.sessionDrops - before.drops, essence: s.essence - before.essence, kills: s.kills - before.kills };
    }
    function serialize(s: IdleGameState, now = Date.now()) { const saved = copy(s); saved.savedAt = now; saved.fight = null; saved.logs = []; return JSON.stringify(saved); }
    return { definition, freshState, makeGear, xpNeeded, stats, addLog, grant, beginFight, tick, equip, upgradeCost, upgrade, dismantle, forge, trainPet, unlockPet, hydrate, settleOffline, serialize };
}
