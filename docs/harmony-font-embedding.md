# HarmonyOS Sans SC 随插件嵌入

版本：0.9.3；日期：2026-11-08。

## 字体与许可

本软件使用 HarmonyOS Sans SC，Copyright 2021 Huawei Device Co., Ltd.。

字体来自[华为官方字体包](https://developer.huawei.com/images/download/general/HarmonyOS-Sans.zip)。该包内的 HarmonyOS Sans Fonts License Agreement 明确允许把未经修改的字体随软件嵌入和分发，要求声明使用、保留版权及完整协议，禁止修改字体及单独分发字体产品。

保留的协议：[HarmonyOS-Sans-LICENSE.txt](../assets/fonts/HarmonyOS-Sans-LICENSE.txt)。设置的字体区域也显示了使用及版权声明。

保留原始 TTF，不裁字、不转 WOFF、不修改字体内部名称或轮廓。字体在独立脚本中的 Base64 只是传输容器；解码后的字节与官方文件完全相同。构建时以 SHA256 强制校验：

| 字重 | 源字体 | SHA256 |
| --- | --- | --- |
| 400 | HarmonyOS_Sans_SC_Regular.ttf | 297b088424be212207df2ce8b98e335468b782aa6b96832af0b8b773d711e2b1 |
| 500 | HarmonyOS_Sans_SC_Medium.ttf | 6ed1553edccddc48eb27ff25d134a4a715cf54211238d4840b3038576cba1944 |
| 700 | HarmonyOS_Sans_SC_Bold.ttf | 43a424b85e47fb53a17b3b32026a71801f86f8e022ca6798d186b47d39fa5f01 |

## 加载方式

每个字重先尝试正确的本地完整字体名或 PostScript 名；缺失时调用宿主 `require.async()` 加载对应的 `client.harmony-*.js` 分包，再通过 FontFace 注册到 HarmonyOS Sans SC 字族。主脚本约 2.54MB，三个字体分包合计约 32.86MB；字体是完整中文字库，包体积增加是预期结果，不能把“分包”理解为字体总量减少。

字号和角色继续沿用既有规范：正文用 HarmonyOS Sans SC，等宽文本用 JetBrains Mono，品牌用 Rajdhani，大数字用 Bahnschrift。卸载会撤销自有字体注册，加载在卸载后返回也不会产生残留。失败保留系统字体回退，并在设置中反映字体不可用。

## 验证

- 41 项单元测试、构建一致性、语法及字典检查通过。新增测试覆盖本地复用、缺失时加载、失败回退和卸载后的异步返回。
- 在真实 DSH NEXT 的隔离浏览器中，对 HarmonyOS 的本地 `local()` 来源注入失败，模拟未安装字体；三个真实分包均返回 HTTP 200。
- Chromium 报告 400 / 500 / 700 均由自定义字体渲染：PostScript 名分别为 HarmonyOS_Sans_SC、HarmonyOS_Sans_SC_Medium、HarmonyOS_Sans_SC_Bold；每个样本的 22 个中英文字形全部由该字体提供。
- 设置面板显示四种角色字体可用，HarmonyOS 使用声明可见，无页面错误。
- 包内容检查确认三个分包与官方许可证均在发布清单内。插件解包后约 35.47MB，压缩包约 19.77MB；大小会随说明文档小幅变化。

浏览器原始证据保存在开发者本地的 `.artifacts/`，不随公开仓库上传。仓库提供字体加载的单元测试、构建校验和只读浏览器回归脚本，可在自己的 DSH 环境中复核。
