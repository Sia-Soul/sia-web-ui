/** 校验 Windows EXE 真正内嵌的图标帧与正式 ICO 一致，不依赖资源管理器缓存或启动窗口。 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const exe = fs.readFileSync(process.argv[2] || 'D:/SiaBuild/SiaWebUI/target/release/sia-browser.exe');
const ico = fs.readFileSync(path.join(root, 'apps/browser/src-tauri/icons/icon.ico'));
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const pe = exe.readUInt32LE(0x3c);
const optional = pe + 24;
const directories = optional + (exe.readUInt16LE(optional) === 0x20b ? 112 : 96);
const sectionTable = optional + exe.readUInt16LE(pe + 20);
/** 把 PE 的虚拟地址映射到文件偏移；只读取已落盘的资源段。 */
function offset(rva) {
  for (let i = 0; i < exe.readUInt16LE(pe + 6); i++) {
    const s = sectionTable + i * 40;
    const start = exe.readUInt32LE(s + 12);
    if (rva >= start && rva < start + exe.readUInt32LE(s + 16)) return exe.readUInt32LE(s + 20) + rva - start;
  }
  throw new Error('资源地址不在 PE 文件内');
}
const base = offset(exe.readUInt32LE(directories + 16));
const frames = [];
/** 只遍历 RT_ICON，比较原始帧，避免不同渲染器的抗锯齿差异影响结论。 */
function visit(relative, type) {
  const p = base + relative;
  const count = exe.readUInt16LE(p + 12) + exe.readUInt16LE(p + 14);
  for (let i = 0; i < count; i++) {
    const entry = p + 16 + i * 8;
    const id = exe.readUInt32LE(entry);
    const value = exe.readUInt32LE(entry + 4);
    const current = type ?? id;
    if (current !== 3) continue;
    if (value & 0x80000000) visit(value & 0x7fffffff, current);
    else {
      const data = base + value;
      const start = offset(exe.readUInt32LE(data));
      frames.push(hash(exe.subarray(start, start + exe.readUInt32LE(data + 4))));
    }
  }
}
visit(0);
for (let i = 0; i < ico.readUInt16LE(4); i++) {
  const p = 6 + i * 16;
  const start = ico.readUInt32LE(p + 12);
  assert(frames.includes(hash(ico.subarray(start, start + ico.readUInt32LE(p + 8)))), `EXE 内嵌图标第 ${i + 1} 帧仍与当前 ICO 不同`);
}
console.log(`PASS: EXE 内嵌图标与正式 ICO 一致（${frames.length} 帧）。`);
