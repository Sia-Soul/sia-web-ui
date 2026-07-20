#!/usr/bin/env node
import { cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectName = process.argv[2];
if (!projectName) {
  console.error("用法：create-sia-web <项目名称>");
  process.exit(1);
}

if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(projectName)) {
  console.error("项目名称只能包含字母、数字、短横线和下划线。");
  process.exit(1);
}

const target = path.resolve(process.cwd(), projectName);
if (existsSync(target)) {
  console.error(`目标目录已存在：${target}`);
  process.exit(1);
}

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "template");
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
await rename(path.join(target, "_gitignore"), path.join(target, ".gitignore"));

const packagePath = path.join(target, "package.json");
const packageText = await readFile(packagePath, "utf8");
await writeFile(packagePath, packageText.replace("sia-web-app", projectName.toLowerCase()), "utf8");

console.log(`\n已创建 ${projectName}`);
console.log(`\n  cd ${projectName}`);
console.log("  pnpm install");
console.log("  pnpm dev\n");

