/** 下载首次触发时间；旧记录可暂缺，恢复时按原有记录顺序补齐。 */
interface TimedDownload {
  startedAt?: number;
}

/** 按下载触发时间倒序排列，不修改原数组；进度及完成时间不参与排序。 */
export function newestDownloadsFirst<T extends TimedDownload>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
}

/** 同一毫秒的多个新下载仍保持触发先后，系统时钟回拨也不会把新下载排到历史项后面。 */
export function nextDownloadStartedAt(entries: readonly TimedDownload[]): number {
  return Math.max(Date.now(), ...entries.map(entry => (entry.startedAt ?? 0) + 1));
}
