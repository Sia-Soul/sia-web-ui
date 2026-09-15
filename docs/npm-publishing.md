# 发布 @sia.soul/sia-react-ui

以下命令在 PowerShell 中执行。正式发布的是 packages/react 子包；仓库根目录保持 private: true。

## 一键发布（推荐）

在仓库根目录执行：

```powershell
pnpm release:ui
```

命令固定使用 npm 官方源，先检查登录身份；凭据过期或未登录时打开 npm 网页登录流程，登录成功后自动继续。浏览器登录和发布所需的双重验证仍需本人完成。随后执行 npm version patch --no-git-tag-version 自动递增组件包的补丁版本，再通过包内的 prepublishOnly 执行类型检查、构建，并以 public / latest 发布组件包。

默认更新 packages/react/package.json 的 patch 版本，例如 0.1.6 → 0.1.7。也可以指定更新类型：

```powershell
pnpm release:ui minor
pnpm release:ui major
```

不执行 Git 提交、标签或推送。登录检查失败时不会递增版本；版本更新失败时不发布。构建或发布失败后保留已递增的本地版本，不自动重试。请先检查 npm 上的实际发布结果，确认该版本未发布后，使用以下命令重试同一版本，避免再次递增：

```powershell
pnpm release:ui --no-bump
```

如果已经手动更新版本号，也可以使用 --no-bump。已发布的版本不能重复发布。

只验证构建和发布包内容、不上传时执行：

```powershell
pnpm release:ui --dry-run
```

预演跳过登录，不修改本地版本号，使用当前版本验证构建和打包，不验证账号的实际发布权限。此命令不会修改日常安装依赖使用的镜像源。

## 登录

```powershell
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

确认用户名为 sia.soul，按 npm 提示完成发布所需的账号验证。

如果发布返回 E403，并提示 `Two-factor authentication or granular access token with bypass 2fa enabled is required`，说明本次发布凭据未满足 npm 的双重验证要求。在 npm 网站点击头像 → Account → Two-Factor Authentication → Enable 2FA，按页面提示配置安全密钥并保存恢复码。完成后重新执行 npm login，再发布并完成验证。若账号已启用 2FA，先重新登录，确保使用更新后的登录会话。

官方要求：https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/

## 构建与本地打包

在仓库根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm --filter '@sia.soul/sia-react-ui' typecheck
pnpm --filter '@sia.soul/sia-react-ui' build
cd packages/react
npm pack --dry-run
pnpm pack
```

每一步成功后再执行下一步。将生成的 .tgz 安装到工作区之外的 React 项目，验证类型、样式、生产构建以及实际使用的组件。文件名以命令输出为准。

发布前填写与作者授权意图一致的许可证；不要仅因为 npm 包公开就假定它采用某个开源许可证。

## 正式发布

在 packages/react 目录执行以下命令，将该版本公开上传到 npm：

```powershell
npm publish --access public --registry=https://registry.npmjs.org/
```

prepublishOnly 会自动执行类型检查和构建。按提示完成身份验证。

## 检查发布结果

```powershell
npm view '@sia.soul/sia-react-ui' version --registry=https://registry.npmjs.org/
```

其他人在自己的 React 项目中安装：

```powershell
pnpm add '@sia.soul/sia-react-ui'
```

## 后续更新

已发布的相同版本不能覆盖。推荐直接在根目录运行 pnpm release:ui，自动递增补丁版本并发布。如果需要手动更新，可以在 packages/react 目录执行：

```powershell
npm version patch --no-git-tag-version
```

返回仓库根目录更新锁文件，按需更新项目生成器模板中的依赖版本，再通过 pnpm release:ui --no-bump 验证和发布，避免重复递增。Git 提交与标签按项目发布流程单独处理。

官方说明：https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/
