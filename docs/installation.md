# 安装与开发

## 环境

- DSH NEXT；本项目针对 2.0.22-next / 内置 DSH 0.2.2-rc.1 检查了界面结构。
- 开发时使用 Node.js 24、npm 和 Git。
- Git 仓库中包含已构建客户端及字体分包，克隆后可直接作为本地插件链接，无须先安装开发依赖。

## 通过本地目录安装

```sh
git clone https://github.com/Return761/aic-console-theme.git
```

在 DSH 插件管理器中使用其提供的本地插件安装/链接入口，选择克隆得到的 `aic-console-theme` 目录，然后启用 AIC 控制台主题并刷新客户端。不同 DSH 版本的入口名称可能变化，请以实际插件管理器提供的路径安装方式为准。

不要复制文件到 DSH 安装目录，也不要修改 DSH 的 app.asar。

启用前建议关闭其他覆盖同一界面的主题，避免样式叠加。首次在缺少 HarmonyOS Sans SC 的设备上使用时，会从插件加载三个字体分包；后续由本地浏览器缓存处理。本机有对应字体时优先复用。

## 开发

```sh
npm ci
npm run build
npm run check
npm test
```

编辑 `src/` 后构建，勿直接修改生成的 `client.js` 或 `client.harmony-*.js`。HarmonyOS 字体保持官方原始 TTF；构建会核对 SHA256，不能裁字或转换格式。

`scripts/build.mjs` 在存在 DSH 安装时读取账号客户端版本，否则使用便携构建默认值。CI 先执行构建再检查生成物，避免把不同主机上的账号元数据差异误判为源码问题。余额功能仍以宿主实际提供的账号接口为准。

## 可选：真实页面回归

把本机 DSH 生成的完整访问链接放进当前进程的 `DSH_WEB_URL` 环境变量。不要将带 token 的链接写入源码、issue 或提交记录。

```powershell
$env:DSH_WEB_URL = '<当前本地访问链接>'
$env:DSH_SESSION_TITLE = '<用于只读检查的已有会话标题>'
$env:DSH_WORKSPACE_NAME = '<对应工作区名称>'
node scripts/browser-check.mjs
```

脚本在隔离浏览器上下文中检查界面，不发送消息、不切换模型、不启动 Agent。浏览器截图、会话信息和本地报告写入已忽略的 `.artifacts/`。

## 卸载

在 DSH 插件管理器禁用或移除本插件并刷新客户端。插件拥有的样式、监听器、插槽及字体注册均在生命周期结束时回收。主题设置保留在当前浏览器，可先在设置中“恢复默认设置”后再卸载。
