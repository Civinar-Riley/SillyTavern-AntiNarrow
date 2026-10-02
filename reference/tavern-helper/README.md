# 酒馆助手脚本开发资料（搬运存档）

开发本脚本所用到的酒馆助手（JS-Slash-Runner / TavernHelper）资料精选。原文出处：
[官方文档](https://n0vi028.github.io/JS-Slash-Runner/Doc/) 与
[仓库 @types](https://github.com/N0VI028/JS-Slash-Runner/tree/main/@types)，
版权归原作者所有，此处仅作开发存档；更新请以上游为准。

| 文件 | 内容 | 本项目用到的地方 |
|---|---|---|
| `脚本库.md` | 脚本导入格式、全局/预设/角色三层脚本库、`$(()=>{})` 启动、`pagehide` 停用钩子 | 生命周期骨架 |
| `script.d.ts` | `getButtonEvent` / `appendInexistentScriptButtons` / `getScriptName` 等 | 脚本按钮「防窄化设置」自注册与监听 |
| `event.d.ts` | `tavern_events` 全表 + `eventOn/eventOnce/eventEmitAndWait` | `CHAT_CHANGED` 维持新楼层 |
| `util.d.ts` | `getCurrentMessageId`（仅楼层 iframe 可用）、`getIframeName` 等 | 避坑：脚本里不要调楼层专用 API |
| `监听和发送事件.md` | 事件监听自动卸载、`eventRemoveListener` | 停用无需手动清理 |
| `获取脚本.md` | `Script` 类型（type/name/id/content/button/data） | JSON 导入文件的字段结构 |
| `开发要点笔记.md` | 实战踩坑：`window.parent.document` 访问宿主、固定 id 防双开、样式注入模式 | 注入与清理模式 |

## 本脚本依赖的核心模式（速查）

```js
// 宿主文档：脚本跑在隐藏 iframe 里，绝不能裸用 document
const doc = window.parent?.document ?? document;

// 幂等注入：固定 id，先删旧实例防双开/热重载残留
doc.getElementById(STYLE_ID)?.remove();
const style = doc.createElement('style');
style.id = STYLE_ID;
style.textContent = CSS;
doc.head.appendChild(style);

// 生命周期：$() 替代 DOMContentLoaded；pagehide = 脚本停用/删除
$(() => init());
window.addEventListener('pagehide', cleanup, { once: true });

// 脚本按钮：编辑页「按钮」区声明（或自注册），代码里监听
appendInexistentScriptButtons([{ name: '防窄化设置', visible: true }]);
eventOn(getButtonEvent('防窄化设置'), togglePanel);
```
