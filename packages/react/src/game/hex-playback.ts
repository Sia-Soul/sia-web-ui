import type { GameBattlePlayback, GameHexUnit } from './types';

/** 当前可见棋子快照；移动时 q/r 为小数，仅用于画面，不回写规则坐标。 */
export interface GameHexFrame {
    /** 按事件时刻应用气血和移动后的单位。 */ units: GameHexUnit[];
    /** 当前回合归一化时间，范围 0 至 1。 */ progress: number;
}
/** 按归一化时刻读取回合画面；命中前不扣血，移动只在相邻格之间插值，不改变原快照。 */
export function sampleHexPlayback(playback: GameBattlePlayback, progress: number): GameHexFrame {
    const t = Math.max(0, Math.min(1, progress)), units = playback.units.map(unit => ({ ...unit }));
    for (const cue of playback.cues) {
        if (t < cue.at) continue;
        const unit = units.find(u => u.id === (cue.target ?? cue.actor));
        if (cue.kind === 'move' && cue.from && cue.to) {
            const moving = units.find(u => u.id === cue.actor);
            if (moving) { const p = Math.min(1, (t - cue.at) / .12), eased = p * p * (3 - 2 * p); moving.q = cue.from.q + (cue.to.q - cue.from.q) * eased; moving.r = cue.from.r + (cue.to.r - cue.from.r) * eased; }
        }
        if (unit && (cue.kind === 'hit' || cue.kind === 'heal') && cue.hp !== undefined) unit.hp = cue.hp;
    }
    return { units, progress: t };
}
