<div align="center">

# 📐 防窄化 · 沉浸全宽

**把 SillyTavern（酒馆）楼层被头像列与内边距吃掉的那约 100px 还回来 · 单文件酒馆助手脚本，导入即用、全部可配置**

[![Platform](https://img.shields.io/badge/platform-SillyTavern-6a4c93?style=flat-square)](https://github.com/SillyTavern/SillyTavern)
[![Runtime](https://img.shields.io/badge/runtime-%E9%85%92%E9%A6%86%E5%8A%A9%E6%89%8B%E8%84%9A%E6%9C%AC-4a90d9?style=flat-square)](https://github.com/N0VI028/JS-Slash-Runner)
[![Version](https://img.shields.io/badge/version-v1.1-2f81f7?style=flat-square)](https://github.com/Civinar-Riley/SillyTavern-AntiNarrow/tree/v1.1)
[![License](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-lightgrey?style=flat-square)](#-声明与授权)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)
[![Last commit](https://img.shields.io/github/last-commit/Civinar-Riley/SillyTavern-AntiNarrow?style=flat-square)](https://github.com/Civinar-Riley/SillyTavern-AntiNarrow/commits/main)

[项目简介](#-项目简介) · [功能特性](#-功能特性) · [安装](#-安装) · [使用指南](#-使用指南) · [限制与已知问题](#-限制与已知问题) · [仓库结构](#-仓库结构) · [常见问题](#-常见问题) · [版本历史](#-版本历史) · [声明与授权](#-声明与授权) · [致谢](#-致谢)

</div>

---

## 📖 项目简介

**防窄化 · 沉浸全宽**（仓库名 `SillyTavern-AntiNarrow`）是一个酒馆助手全局脚本，只做一件事：把消息楼层被「头像列 + 左右内边距」吃掉的水平宽度还回来，让正文美化卡、开场页 iframe、思考折叠块、媒体行、普通文本全部铺满整条聊天列。

- **问题出在宿主布局，不在你的页面**：酒馆消息行自带约 90~100px 的固定 insets——头像列 50px、`.mes` 左右内边距各 10px、`.mes_block` 左 10px、`.mes_text` 右缘预留位 30px。412px 手机视口下，真正留给内容的宽度只剩约 60%，任何做成整页效果的 HTML 都会被挤成中间一条窄带；
- **不碰 iframe**：脚本跑在酒馆助手的隐藏 iframe 里，经 `window.parent.document` 向宿主文档注入一段 `!important` CSS 清零这些内边距，并把头像列 DOM 搬进名字栏。iframe 里的页面本来就按可用宽度的 100% 渲染，把宽度还给它即可；
- **全部可配置**：七项设置收在脚本按钮「防窄化设置」面板里，从「只搬头像」到「整条聊天列拉满全屏」都能一键切，改动即时生效并自动记忆；
- **无痕启停**：停用或删除脚本会自动还原头像、移除注入样式与面板，不留残留；样式看门狗保证注入规则不被晚加载的主题或美化脚本盖掉；
- **零依赖单文件**：`src/mt-antinarrow.js` 一个文件即全部逻辑，不使用任何第三方库。

逐行核对酒馆 `public/style.css` 得来的根因分析与实现要点，整理在 [docs/窄化根因与修复原理.md](./docs/窄化根因与修复原理.md)。

## ✨ 功能特性

### 入口一 · 楼层渲染（加载后自动生效，无需操作）

| 特性 | 说明 |
| :--- | :--- |
| 📐 清零消息行内边距 | `.mes` 左右各 10px、`.mes_block` 左 10px、`.mes_text` 右 30px 一并清零，思考折叠块与媒体行同源的 30px 右缩进成对处理（负边距不冲出边缘） |
| 🖼️ 头像列搬进名字栏 | 默认档。头像在 `.ch_name` 行内显示，消息行让出整列 50px；已被其他脚本搬走的头像自动跳过，不重复搬家 |
| ↕️ 重roll 空带补偿 | 头像离开消息行后，末楼底部按 `calc(var(--avatar-base-height,50px) + 4px)` 补回 `‹ ›` 空带；检测到宿主已开启沉浸类布局（`body.immersive-mode`）时自动让位，避免双重预留 |
| 📏 楼层左右留白 | 用 `margin` 而非 padding 内缩 `.mes`（`width: calc(100% - 2×留白)`），不参与 content-box 计算，四档：贴边 / 小 8px / 中 14px / 大 20px |
| 🖥️ 聊天列拉满全屏 | 连 `--sheldWidth` 一起覆盖为 100vw；左右导航抽屉、`#floatingPrompt` 与 `#cfgConfig` 浮层同步全屏展开，抽屉顶栏图标行保持可点、可正常关闭 |
| 📱 仅窄屏生效 | 断点默认 1000px（对齐酒馆移动端）；跨断点时自动搬移/还原头像，桌面端连头像位置一起保持原版 |
| 🧹 停用即还原 | 官方 `pagehide` 停用钩子按 `data-mt-antinarrow-moved` 标记还原头像，并移除注入的样式与面板；热重载/双开时旧实例不会拆掉新实例的节点 |
| 🐕 样式看门狗 | 晚加载的主题或脚本把 `<style>` 插到本脚本之后时，自动把规则挪回 `head` 末尾——所有规则本就 `!important`，同优先级比顺序，本脚本因此保持胜出 |

### 入口二 · 设置面板「防窄化设置」

| 特性 | 说明 |
| :--- | :--- |
| 🎛️ 七项设置即时生效 | 注入 / 头像列 / 聊天列宽 / 生效范围 / 重roll条 / 左右留白 / 窄屏断点，点一下立刻重建注入规则 |
| 💾 自动记忆 | 档位写入宿主 localStorage（key `mtAntiNarrow.settings.v1`），刷新、换角色、重启浏览器后仍在 |
| 🚑 注入急救开关 | 「注入」切到「暂停」即清空全部注入并还原头像，用于一键隔离验证「是不是本脚本和其他美化冲突」 |
| ♻️ 恢复默认 | 面板底部按钮，一键回到出厂档位 |

## 📦 安装

**环境要求**

- **宿主**：[SillyTavern](https://github.com/SillyTavern/SillyTavern)（酒馆）本体，桌面端与移动端皆可；
- **扩展**：酒馆助手（JS-Slash-Runner）——脚本运行环境；面板按钮用到的 `getButtonEvent` 与 `appendInexistentScriptButtons` 由它提供；
- **不需要**：npm、构建步骤、任何第三方库；两个 JSON 都是导入即用的成品。

**导入步骤（两种方式二选一，不要同时启用）**

1. **下载脚本 JSON**：从 [`dist/`](./dist) 里选一个导入文件（见下方对比）；
2. **导入**：酒馆 → 扩展（酒馆助手）→ 脚本库 → **全局脚本库** → 导入，选择刚下载的 JSON；
3. **确认按钮开关**：脚本编辑页顶部**「按钮」开关需处于开启状态**（两个 JSON 都已预置「防窄化设置」按钮，关闭状态下按钮栏里不会出现）；
4. **确认生效**：脚本按钮栏出现「防窄化设置」，点开即面板；楼层的正文卡 / iframe / 思考块应已铺满整条聊天列。

**两种导入文件对比**

| 文件 | 内容 | 优点 | 代价 |
| :--- | :--- | :--- | :--- |
| [`酒馆助手脚本-防窄化沉浸全宽.json`](./dist/酒馆助手脚本-防窄化沉浸全宽.json) | 代码完整内置（24,671 字符） | 离线可用，版本固定，不受 CDN 影响 | 仓库更新后需重新导入 |
| [`酒馆助手脚本-防窄化沉浸全宽-CDN加载器.json`](./dist/酒馆助手脚本-防窄化沉浸全宽-CDN加载器.json) | 只有一行 `import` | 实时跟随仓库 `main` 分支，更新无需重新导入 | 断网或 jsDelivr 不可达时无效 |

CDN 加载器版的全部代码就这一行：

```js
import 'https://cdn.jsdelivr.net/gh/Civinar-Riley/SillyTavern-AntiNarrow@main/src/mt-antinarrow.js';
```

`@main` 换成 `@v1.1` 即可锁定版本（实测响应头：`@main` 为 `s-maxage=43200`（12 小时边缘缓存），`@v1.1` 为 `immutable` 一年）。

**配置一览**

| 项 | 位置 | 说明 |
| :--- | :--- | :--- |
| 七项运行档位 | 脚本按钮「防窄化设置」面板 | 即时生效，存于 localStorage `mtAntiNarrow.settings.v1` |
| 出厂默认值 | `src/mt-antinarrow.js` 顶部 `DEFAULTS` | 改完需重新生成/导入 JSON 才生效 |
| 侧边悬浮齿轮 | `DEFAULTS.showFloatingGear` | 默认 `false`（用脚本按钮开面板）；改 `true` 后额外显示侧边齿轮，位置由 `buttonSide` 决定 |

> ⚠️ **两个 JSON 只能启用一个**：同时导入会出现**两个同名「防窄化设置」按钮**，功能重复且难排查。
> ⚠️ **CDN 加载器版依赖网络**：断网、jsDelivr 被墙或不可达时脚本不生效，此时请改用自包含版。
> ⚠️ **面板按钮依赖编辑页的「按钮」开关**：开关关闭时按钮不显示，脚本本体仍在运行——想开面板也可以把 `DEFAULTS.showFloatingGear` 改成 `true`。

## 🚀 使用指南

| 场景 | 操作 |
| :--- | :--- |
| **首次导入，确认是否生效** | 点脚本按钮栏的「防窄化设置」能弹出面板 → 打开有 iframe / 美化卡的楼层，内容应铺满整条聊天列，两侧不再露出空白 |
| **桌面端想保持原版观感** | 面板「生效范围」→「仅窄屏」：CSS 整体包进 `@media`，桌面端连头像位置一起还原 |
| **想要完全沉浸（整屏）** | 面板「聊天列宽」→「拉满全屏」；左右导航抽屉与提示词/CFG 浮层会跟着全屏展开，顶栏图标行仍可点击关闭 |
| **手机上仍觉得贴边太紧** | 面板「左右留白」在 贴边 / 小 8px / 中 14px / 大 20px 之间切换，即时生效 |
| **怀疑与其他美化脚本冲突** | 面板「注入」→「暂停」→ 页面恢复正常即与本脚本有关，排查完切回「开」；「暂停」会清空注入并还原头像 |
| **末楼的重roll 按钮压住正文** | 面板「重roll条」→「开」（头像列选「保留」时原生空带仍在，无需补偿） |
| **不想重新导入就跟随仓库更新** | 改用 `dist/酒馆助手脚本-防窄化沉浸全宽-CDN加载器.json`，它实时拉取 `main` 分支源码 |
| **临时停用 / 彻底删除** | 面板「注入」暂停可临时停；停用或删除脚本本体会自动还原头像、样式与面板，不会残留 |
| **不装酒馆，先在浏览器里看效果** | 仓库根目录跑 `python -m http.server 8791`，打开 `http://127.0.0.1:8791/tests/_script_host.html`，窗口调到 412px 宽即为手机视口；详见 [tests/README.md](./tests/README.md) |

## 🚧 限制与已知问题

| 限制 | 原因 | 能否绕过 |
| :--- | :--- | :--- |
| 档位只存在浏览器里，换浏览器或清缓存后回到默认 | 不使用任何服务端存储，全部落在 localStorage | ❌ 设计如此，重设一次即可 |
| 头像「搬到名字栏」后位置与原版不同 | 头像 DOM 被移出消息行、放进 `.ch_name` | ✅ 面板「头像列」→「保留」完全还原 |
| 头像「收起」时头像不可见也不可点 | 该档对直接子列 `display:none` | ✅ 换成「搬到名字栏」或「保留」 |
| 全平台清零内边距会改变桌面端楼层观感 | 这是本脚本的功能本身，不是 bug | ✅ 面板「生效范围」→「仅窄屏」，或随时切档还原 |
| 「拉满全屏」下 movingUI 拖拽面板按酒馆原生公式收缩 | 酒馆 `.draggable` 宽度为 `calc((100vw - var(--sheldWidth))/2)`，`--sheldWidth` 拉满 100vw 后算式为负，收在 `min-width:100px` 保底宽 | ⚠️ 左右导航抽屉与 `#floatingPrompt` / `#cfgConfig` 已由本脚本补回全屏；`#logprobsViewer` 等其余拖拽面板未覆盖 |
| CDN 加载器版断网或 jsDelivr 不可达时无效 | 代码需要实时从 CDN 取 | ✅ 改用自包含版 |
| 两个 JSON 同时启用会出现两个同名按钮 | 酒馆助手按脚本各注册一次按钮 | ✅ 只启用其中一个 |
| 主题若用更高优先级或内联样式改写 `.mes` 宽度 | CSS 优先级竞争 | ⚠️ 本脚本规则全部 `!important` 且有看门狗保序，通常胜出；仍异常时用面板「注入」暂停做隔离验证 |

## 📁 仓库结构

```
SillyTavern-AntiNarrow/
├── dist/                                              # 可直接导入酒馆助手的成品脚本（二选一）
│   ├── 酒馆助手脚本-防窄化沉浸全宽.json                 #   自包含版：代码完整内置，离线可用
│   └── 酒馆助手脚本-防窄化沉浸全宽-CDN加载器.json        #   CDN 加载器版：单行 import，跟随仓库更新
├── src/
│   └── mt-antinarrow.js                               # 脚本源码，与自包含版 JSON 的 content 逐字一致
├── docs/
│   └── 窄化根因与修复原理.md                            # 对着酒馆 style.css 逐行核对的根因分析与实现要点
├── reference/tavern-helper/                           # 酒馆助手开发资料搬运存档（第三方，版权归上游）
│   ├── README.md                                      #   存档索引 + 本脚本用到的核心模式速查
│   ├── script.d.ts / event.d.ts / util.d.ts           #   官方类型定义摘录（脚本按钮、事件表、工具函数）
│   └── 脚本库.md / 获取脚本.md / 监听和发送事件.md / 开发要点笔记.md
├── tests/
│   ├── README.md                                      # 本地模拟验证说明
│   ├── _script_host.html                              # 按酒馆消息模板复刻的验证页（直引 ../src 源码）
│   └── _stub_page.html                                # iframe 占位页，模拟楼层里的整页 HTML
├── LICENSE                                            # CC BY-NC-SA 4.0
├── README.md
└── .gitignore
```

## ❓ 常见问题

**Q：导入后面板按钮栏里没有「防窄化设置」？**
A：先看脚本编辑页顶部的**「按钮」开关**是否开启——两个 JSON 都已预置该按钮，但开关关闭时酒馆助手不显示它。另一个办法是把源码 `DEFAULTS.showFloatingGear` 改成 `true`，用侧边悬浮齿轮开面板。

**Q：怎么判断脚本真的生效了？**
A：打开一个带正文卡或 iframe 的楼层，内容应铺满整条聊天列、两侧不留空白；点「防窄化设置」按钮能弹出面板，也说明脚本已在运行。不装酒馆时可用 `tests/_script_host.html` 复现，页面每 400ms 输出实时的计算样式。

**Q：自包含版和 CDN 加载器版有什么区别？该选哪个？**
A：功能完全相同，区别只在代码来源。想要稳定离线用自包含版；想跟着仓库更新走、不想每次重新导入就用 CDN 版。**两个都导入会出现两个同名按钮**，只启用一个即可。

**Q：想锁定 CDN 版本怎么办？**
A：把 URL 里的 `@main` 换成 `@v1.1`。注意：本仓库目前只有 `v1.1` 一个 tag，`@v1.0` 在 jsDelivr 上会返回 404——锁定版是 `immutable` 一年缓存，`@main` 则是 12 小时边缘缓存，因此刚推送的改动不一定立刻生效。

**Q：设置存在哪？会同步到别的设备吗？**
A：存在宿主页面的 localStorage，key 为 `mtAntiNarrow.settings.v1`，不联网、不上传、也不跨设备同步；换浏览器或清缓存后回到默认档位。

**Q：头像搬进名字栏后，点头像放大还能用吗？**
A：能。酒馆的头像放大用的是事件委托 `$(document).on('click', '.mes .avatar')`，头像搬到 `.ch_name` 后仍在 `.mes` 之内，事件照常命中；只有「收起」档把头像 `display:none` 之后才点不到。

**Q：会不会和其他沉浸类 / 美化脚本打架？**
A：头像只搬一次（已被任何脚本搬走的头像会被跳过，还原时也只动本脚本标记过的节点），CSS 规则幂等；双方都在改 `--sheldWidth` 时，本脚本的看门狗会把注入样式保持在 `head` 末尾，因此通常最终生效的是本脚本。真出问题时用面板「注入」暂停即可一键隔离。

**Q：停用脚本后会留下什么吗？**
A：不会。停用或删除脚本触发 `pagehide` 钩子，按 `data-mt-antinarrow-moved` 标记把头像放回消息行，并移除注入的两段样式、面板与齿轮；观察器与定时器也一并清理，不会出现「停用后头像又被搬走」的复活现象。

## 🕘 版本历史

| 日期 | 版本 | 更新内容 |
| :--- | :--- | :--- |
| 2026-10-02 | v1.1 | 修复「仅窄屏」下 DOM 搬移与 `@media` 不同步、热重载/双开互拆、停用后定时器复活等问题；新增样式看门狗与「注入」急救暂停开关；修复「拉满全屏」时左右导航抽屉与浮层塌缩成窄条、全屏抽屉关不掉 |
| 2026-10-02 | v1.0 | 首个版本：清零消息行内边距 + 头像列搬进名字栏 + 设置面板；同日加入 CDN 加载器版脚本 |

> 版本号来自仓库 git tag（`v1.1`）与提交信息（`v1.0`）。本仓库没有 `package.json`，源码内也不含版本常量，因此以 tag 为准。

## 📜 声明与授权

本项目采用 [CC BY-NC-SA 4.0](./LICENSE)（署名-非商业性使用-相同方式共享 4.0 国际）协议：可自由使用与修改，但**不得用于商业用途**，且修改后的作品须以相同协议共享并署名。

> 该协议在 GitHub 侧边栏可能显示为 `Other`（GitHub 对 CC 系列协议的识别限制，仓库 API 返回 `NOASSERTION`），这是平台行为，不影响协议本身。

## 🙏 致谢

- [SillyTavern](https://github.com/SillyTavern/SillyTavern) —— 宿主本体，本脚本清零的每一项内边距都来自其 `public/style.css`；
- [酒馆助手 JS-Slash-Runner](https://github.com/N0VI028/JS-Slash-Runner) —— 脚本运行环境与 API（脚本按钮、事件、生命周期钩子），`reference/tavern-helper/` 是其公开资料的搬运存档；
- [LittleWhiteBox（小白X）](https://github.com/RT15548/LittleWhiteBox) —— 提供沉浸布局思路（清零消息行内边距 + 头像列搬行）；本项目代码为独立实现，未使用其源码；
- [jsDelivr](https://www.jsdelivr.com/) —— CDN 加载器版的免费分发。
