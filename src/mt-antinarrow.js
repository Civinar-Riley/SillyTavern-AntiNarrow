/**
 * 防窄化 · 沉浸全宽 (mt-antinarrow)
 * ---------------------------------------------------------------
 * 酒馆助手全局脚本：解决消息楼层被「头像列 + 左右内边距」挤压成中间窄条的问题，
 * 让正文卡、开场页 iframe、思考折叠块、媒体行等一切楼层内容铺满整条聊天列。
 *
 * 原理：不碰任何 iframe——脚本向酒馆宿主文档注入一段 !important CSS，
 * 清零 .mes 左右 10px、.mes_block 左 10px、.mes_text 右 30px（以及思考块/媒体
 * 同源的 30px 右缩进），并把头像列搬进楼层数字栏（若其他脚本已把头像搬进
 * 名字栏，本脚本自动跳过，互不覆盖）。
 *
 * 用法：酒馆助手 → 脚本库 → 全局脚本库 → 导入本 JSON（或新建脚本粘贴本文件）。
 * 打开设置面板：点酒馆助手脚本按钮「防窄化设置」（导入后自动存在；编辑页「按钮」开关
 * 需开启）。默认不再注入悬浮齿轮；想要侧边齿轮，把 DEFAULTS.showFloatingGear 改为 true。
 * 面板：注入急救开关 / 头像列三档 / 聊天列宽 / 生效范围 / 重roll条 / 左右留白 / 窄屏断点，
 * 改动即时生效并自动记忆（localStorage）。
 * 停用/删除脚本时自动还原全部 DOM 与样式，无残留；注入的样式由看门狗保持在文档末尾，
 * 不被晚加载的主题/其他脚本盖掉。
 */
(() => {
  'use strict';

  // =============== 默认配置（面板可改，改完记忆在浏览器，无需改代码） ===============
  const DEFAULTS = {
    paused: false,       // true=急救暂停：不注入 CSS、不搬头像，用于一键排查与其他美化的冲突
    avatarMode: 'move',  // 'move'=头像搬到名字栏 | 'hide'=收起头像列 | 'keep'=保留原样
    widenColumn: false,  // false=聊天列宽由酒馆滑条/主题决定 | true=拉满全屏(100vw)
    narrowOnly: false,   // false=全平台生效 | true=仅窄屏(≤breakpoint)生效（桌面端连头像搬移一起还原）
    swipeStrip: true,    // true=末楼底部预留重roll条(‹ ›不压正文)；宿主带沉浸类布局(.immersive-mode)时自动让位
    breakpoint: 1000,    // narrowOnly=true 时的窄屏断点(px)，与酒馆移动端断点一致
    sidePad: 8,          // 楼层左右留白(px)：0=贴边 | 8=小 | 14=中 | 20=大
    showFloatingGear: false, // false=用酒馆助手脚本按钮「防窄化设置」开面板 | true=额外显示侧边悬浮齿轮
    buttonSide: 'right', // 悬浮齿轮位置：'right' | 'left'（仅 showFloatingGear=true 时有效）
  };

  const STORE_KEY = 'mtAntiNarrow.settings.v1';
  const STYLE_ID = 'mt-antinarrow-style';       // 布局规则（可能被 @media 包裹）
  const UI_STYLE_ID = 'mt-antinarrow-ui-style'; // 齿轮+面板样式（永不参与媒体查询）
  const BTN_ID = 'mt-antinarrow-gear';
  const PANEL_ID = 'mt-antinarrow-panel';
  const MOVED_ATTR = 'data-mt-antinarrow-moved';
  const BUTTON_NAME = '防窄化设置'; // 酒馆助手脚本按钮：点击开/关设置面板
  const OWNER = Math.random().toString(36).slice(2); // 实例令牌：热重载/双开时 cleanup 只拆自己的节点

  // 脚本运行在酒馆助手的隐藏 iframe 里，宿主文档必须经 window.parent 取；
  // 万一跨域取不到父文档（非酒馆环境/测试页），退化为自身
  let host = window;
  try {
    if (window.parent && window.parent !== window) host = window.parent;
  } catch (e) { /* 同上 */ }
  const doc = host.document;

  // ---------------------------- 设置读写 ----------------------------
  let settings = loadSettings();

  function clampBreakpoint(v) {
    v = Math.round(Number(v));
    // !Number.isFinite 兜住非法值；v<=0 兜住输入框清空（Number('')===0）等情况，都回默认
    if (!Number.isFinite(v) || v <= 0) return DEFAULTS.breakpoint;
    return Math.min(2000, Math.max(400, v));
  }

  function loadSettings() {
    const s = Object.assign({}, DEFAULTS);
    try {
      const raw = host.localStorage.getItem(STORE_KEY);
      if (raw) Object.assign(s, JSON.parse(raw));
    } catch (e) { /* 读不到就用默认值 */ }
    s.paused = !!s.paused;
    if (!['move', 'hide', 'keep'].includes(s.avatarMode)) s.avatarMode = DEFAULTS.avatarMode;
    s.widenColumn = !!s.widenColumn;
    s.narrowOnly = !!s.narrowOnly;
    s.swipeStrip = !!s.swipeStrip;
    s.breakpoint = clampBreakpoint(s.breakpoint);
    const sp = Math.round(Number(s.sidePad));
    s.sidePad = Number.isFinite(sp) ? Math.min(40, Math.max(0, sp)) : DEFAULTS.sidePad;
    s.showFloatingGear = !!s.showFloatingGear;
    s.buttonSide = s.buttonSide === 'left' ? 'left' : 'right';
    return s;
  }

  function saveSettings() {
    try { host.localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* 存不了就仅本次生效 */ }
  }

  // ---------------------------- CSS 生成 ----------------------------
  function buildCss(s) {
    const pad = Number(s.sidePad) || 0;
    const r = [
      // #chat 原生无横向 padding，此处清零 + 去移动端边框属主题保险
      '#chat{padding-left:0!important;padding-right:0!important;border:0!important}',
      // 左右留白用 margin 实现（margin 不参与 width:100% 计算，避免 content-box 溢出）
      '#chat .mes{padding-left:0!important;padding-right:0!important'
        + ';margin-left:' + pad + 'px!important;margin-right:' + pad + 'px!important'
        + ';width:calc(100% - ' + (pad * 2) + 'px)!important}',
      '#chat .mes .mes_block{padding-left:0!important}',
      '#chat .mes .mes_text{padding:0!important;width:100%!important;max-width:100%!important}',
      // 右缘 30px 预留位（--mes-right-spacing）在思考块/媒体行上的同源缩进，成对清零
      '#chat .mes .mes_reasoning_details{margin-right:0!important}',
      '#chat .mes .mes_reasoning_details .mes_reasoning_summary{margin-right:0!important}',
      '#chat .mes .mes_media_wrapper{padding-right:0!important}',
    ];
    if (s.avatarMode === 'hide') {
      // 只认直接子列：其他脚本把头像搬进 .ch_name 后它是后代而非直接子元素，不会被误藏
      r.push('#chat .mes > .mesAvatarWrapper{display:none!important}');
    }
    if (s.avatarMode === 'move') {
      // 头像进名字栏后，跟随它的末楼 50px 预留会把名字栏撑高，必须清掉
      r.push('#chat .ch_name .mesAvatarWrapper{padding-bottom:0!important;flex:0 0 auto}');
    }
    if (s.swipeStrip && s.avatarMode !== 'keep') {
      // 重roll条：头像列离开消息行后，原生由 .last_mes .mesAvatarWrapper 的
      // padding-bottom 撑出的 ‹ › 底部空带消失，这里在末楼自身补回；
      // body:not(.immersive-mode)：宿主已开启沉浸类布局（自带导航按钮）时自动让位，避免双重预留
      r.push('body:not(.immersive-mode) #chat .mes.last_mes{padding-bottom:calc(var(--avatar-base-height, 50px) + 4px) !important}');
    }
    if (s.widenColumn) {
      // 连 --sheldWidth 一起覆盖：#sheld 自身、依赖该变量的抽屉/齿轮锚点全部一致拉满
      r.push(':root{--sheldWidth:100vw!important;--sheldWidth:100dvw!important}');
      r.push('#sheld{width:100vw!important;max-width:100vw!important;width:100dvw!important;max-width:100dvw!important}');
      // 左右导航抽屉（AI响应配置/角色管理）与提示词/CFG浮层的原生宽度是
      // “聊天列两侧空隙的一半”：calc((100dvw - var(--sheldWidth))/2)，
      // 拉满后算式为负、塌缩成 min-width:100px 窄条 → 照酒馆移动端的做法改为全屏展开。
      // top 必须下移让出顶栏图标行：酒馆关闭抽屉只有“再点一次开关图标”和“点击抽屉
      // 以外区域”两条路，全屏面板(fixed top:0)会把自己的开关图标压在下面、屏幕上也不
      // 再有抽屉以外的可点区域，两条路全断就永远关不掉了；margin-top:0 抵消酒馆移动端
      // 给抽屉另叠的 36px（top+margin 双重偏移会让面板上方漏出一条空隙）
      r.push('#left-nav-panel{top:var(--topBarBlockSize,40px)!important;margin-top:0!important;left:0!important;right:auto!important'
        + ';width:100vw!important;max-width:100vw!important'
        + ';width:100dvw!important;max-width:100dvw!important}');
      r.push('#right-nav-panel{top:var(--topBarBlockSize,40px)!important;margin-top:0!important;left:auto!important;right:0!important'
        + ';width:100vw!important;max-width:100vw!important'
        + ';width:100dvw!important;max-width:100dvw!important}');
      // 浮层保留原生 max-width:90dvw 的收边，只补宽度
      r.push('#floatingPrompt,#cfgConfig{width:100vw!important;width:100dvw!important}');
    }
    const body = r.join('\n');
    return s.narrowOnly
      ? '@media screen and (max-width:' + s.breakpoint + 'px){\n' + body + '\n}'
      : body;
  }

  const UI_CSS = `
/* 齿轮锚定在聊天列内缘：右偏移 = (视口宽 - 聊天列宽)/2 + 8px，PC/手机都在列内可见 */
#mt-antinarrow-gear{position:fixed;z-index:4500;bottom:110px;width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center;border:1px solid color-mix(in srgb,var(--SmartThemeBorderColor,#8888aa) 55%,transparent);border-radius:50%;background:color-mix(in srgb,var(--SmartThemeBlurTintColor,#202020) 88%,transparent);box-shadow:0 2px 10px rgba(0,0,0,.4);color:var(--SmartThemeBodyColor,#dddddd);opacity:.55;cursor:pointer;transition:opacity .15s,transform .15s;right:calc((100vw - var(--sheldWidth, 50vw)) / 2 + 8px);right:calc((100dvw - var(--sheldWidth, 50vw)) / 2 + 8px)}
#mt-antinarrow-gear:hover{opacity:1;transform:rotate(20deg) scale(1.08)}
#mt-antinarrow-gear.mtan-on{opacity:1}
#mt-antinarrow-panel{position:fixed;z-index:4501;bottom:148px;width:min(280px,calc(100vw - 16px));max-height:62vh;overflow-y:auto;padding:10px 12px;border:1px solid color-mix(in srgb,var(--SmartThemeBorderColor,#8888aa) 60%,transparent);border-radius:12px;background:color-mix(in srgb,var(--SmartThemeBlurTintColor,#202020) 96%,transparent);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:var(--SmartThemeBodyColor,#dddddd);font-size:12px;box-shadow:0 10px 28px rgba(0,0,0,.45);right:calc((100vw - var(--sheldWidth, 50vw)) / 2 + 8px);right:calc((100dvw - var(--sheldWidth, 50vw)) / 2 + 8px)}
#mt-antinarrow-panel[hidden]{display:none}
#mt-antinarrow-panel .mtan-title{margin-bottom:8px;font-weight:700;letter-spacing:.08em;color:var(--SmartThemeQuoteColor,#cc9966)}
.mtan-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.mtan-lab{flex:0 0 auto;opacity:.8}
.mtan-group{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.mtan-pill{appearance:none;display:inline-flex;align-items:center;padding:3px 9px;border:1px solid color-mix(in srgb,var(--SmartThemeBorderColor,#8888aa) 60%,transparent);border-radius:999px;background:transparent;color:inherit;font:inherit;font-size:12px;line-height:1.4;cursor:pointer;transition:border-color .15s,background .15s,color .15s}
.mtan-pill:hover{border-color:var(--SmartThemeQuoteColor,#cc9966)}
.mtan-pill.on{border-color:var(--SmartThemeQuoteColor,#cc9966);background:color-mix(in srgb,var(--SmartThemeQuoteColor,#cc9966) 16%,transparent);color:var(--SmartThemeQuoteColor,#cc9966)}
.mtan-pill:focus-visible{outline:2px solid var(--SmartThemeQuoteColor,#cc9966);outline-offset:1px}
.mtan-num{width:76px;padding:3px 6px;border:1px solid color-mix(in srgb,var(--SmartThemeBorderColor,#8888aa) 60%,transparent);border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:12px}
.mtan-num:disabled{opacity:.4}
.mtan-reset{width:100%;margin-top:2px;padding:6px;border:1px dashed color-mix(in srgb,var(--SmartThemeBorderColor,#8888aa) 80%,transparent);border-radius:8px;background:transparent;color:inherit;opacity:.75;font:inherit;font-size:12px;cursor:pointer;transition:opacity .15s,border-color .15s,color .15s}
.mtan-reset:hover{opacity:1;border-color:var(--SmartThemeQuoteColor,#cc9966);color:var(--SmartThemeQuoteColor,#cc9966)}
`;

  const GEAR_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  const PANEL_HTML = `
<div class="mtan-title">防窄化 · 沉浸全宽</div>
<div class="mtan-row"><span class="mtan-lab" title="怀疑与其他美化脚本/主题冲突时切到「暂停」一键隔离验证">注入</span><div class="mtan-group" data-key="paused">
  <button type="button" class="mtan-pill" data-value="false">开</button>
  <button type="button" class="mtan-pill" data-value="true">暂停</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">头像列</span><div class="mtan-group" data-key="avatarMode">
  <button type="button" class="mtan-pill" data-value="move">搬到名字栏</button>
  <button type="button" class="mtan-pill" data-value="hide">收起</button>
  <button type="button" class="mtan-pill" data-value="keep">保留</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">聊天列宽</span><div class="mtan-group" data-key="widenColumn">
  <button type="button" class="mtan-pill" data-value="false">不动</button>
  <button type="button" class="mtan-pill" data-value="true">拉满全屏</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">生效范围</span><div class="mtan-group" data-key="narrowOnly">
  <button type="button" class="mtan-pill" data-value="false">全平台</button>
  <button type="button" class="mtan-pill" data-value="true">仅窄屏</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">重roll条</span><div class="mtan-group" data-key="swipeStrip">
  <button type="button" class="mtan-pill" data-value="true">开</button>
  <button type="button" class="mtan-pill" data-value="false">关</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">左右留白</span><div class="mtan-group" data-key="sidePad">
  <button type="button" class="mtan-pill" data-value="0">贴边</button>
  <button type="button" class="mtan-pill" data-value="8">小</button>
  <button type="button" class="mtan-pill" data-value="14">中</button>
  <button type="button" class="mtan-pill" data-value="20">大</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">窄屏断点(px)</span><input type="number" class="mtan-num" aria-label="窄屏断点" data-key="breakpoint" min="400" max="2000" step="50"></div>
<button type="button" class="mtan-reset">恢复默认</button>
`;

  function injectStyles() {
    if (!doc.head) return;
    let style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      style.dataset.mtanOwner = OWNER;
      doc.head.appendChild(style);
    }
    style.textContent = settings.paused ? '' : buildCss(settings);
    // 挪到 head 末尾：同优先级(!important)规则比的是顺序，晚加载的主题/其他脚本盖不过我们
    if (!settings.paused) doc.head.appendChild(style);

    let ui = doc.getElementById(UI_STYLE_ID);
    if (!ui) {
      ui = doc.createElement('style');
      ui.id = UI_STYLE_ID;
      ui.dataset.mtanOwner = OWNER;
      doc.head.appendChild(ui);
    }
    ui.textContent = UI_CSS;
  }

  // ------------------------ 头像列：搬家 / 还原 ------------------------
  function moveAvatars() {
    if (settings.paused || settings.avatarMode !== 'move' || !isNarrow() || !doc.body) return;
    doc.querySelectorAll('#chat .mes').forEach((mes) => {
      const av = mes.querySelector(':scope > .mesAvatarWrapper');
      if (!av) return; // 已搬走（带本脚本标记或其他脚本搬进名字栏）→ 跳过，避免重复搬家
      const chName = mes.querySelector('.ch_name');
      if (!chName) return;
      av.setAttribute(MOVED_ATTR, '1');
      chName.insertBefore(av, chName.firstChild);
    });
  }

  function restoreAvatars() {
    // 只处理带本脚本标记的节点，不影响其他脚本搬移的头像
    doc.querySelectorAll('#chat .mesAvatarWrapper[' + MOVED_ATTR + ']').forEach((av) => {
      const mes = av.closest('.mes');
      if (!mes) { av.removeAttribute(MOVED_ATTR); return; }
      if (av.parentElement !== mes) {
        // 原生槽位：.for_checkbox/.del_checkbox(隐藏) 之后、.swipe_left 之前
        const anchor = mes.querySelector(':scope > .swipe_left') || mes.querySelector(':scope > .mes_block');
        if (anchor) mes.insertBefore(av, anchor);
        else mes.prepend(av);
      }
      av.removeAttribute(MOVED_ATTR);
    });
  }

  function applyAvatarMode() {
    restoreAvatars(); // 先全部还原，再按新模式与当前视口处理（换档/跨断点/暂停切换即时生效）
    if (settings.avatarMode === 'move') moveAvatars();
  }

  // ------------------------ 窄屏断点同步（DOM 与 CSS 同一条件） ------------------------
  let mql = null;

  function isNarrow() {
    if (!settings.narrowOnly) return true;
    // 必须用宿主视口判断：脚本自己的 iframe 视口不是真实窗口
    try { return host.matchMedia('(max-width:' + settings.breakpoint + 'px)').matches; }
    catch (e) { return true; }
  }

  function onNarrowChange() { applyAvatarMode(); }

  function detachMql() {
    if (!mql) return;
    try {
      if (mql.removeEventListener) mql.removeEventListener('change', onNarrowChange);
      else if (mql.removeListener) mql.removeListener(onNarrowChange);
    } catch (e) { /* 老接口缺失就算了 */ }
    mql = null;
  }

  function syncNarrowState() {
    detachMql();
    if (!settings.narrowOnly) return; // 全平台：无需监听断点
    try {
      mql = host.matchMedia('(max-width:' + settings.breakpoint + 'px)');
      if (mql.addEventListener) mql.addEventListener('change', onNarrowChange);
      else if (mql.addListener) mql.addListener(onNarrowChange);
    } catch (e) { mql = null; }
    onNarrowChange();
  }

  // ------------------------ 新楼层维持 ------------------------
  // 生命周期相关的定时器/观察器全部登记在模块变量上，cleanup 统一清掉，
  // 避免“停用脚本后定时器仍在跑、把头像搬回去”的复活问题
  let observer = null;
  let moveTimer = 0;        // 搬家防抖
  let chatTimer = 0;        // whenChat 轮询
  let chatChangedTimer = 0; // CHAT_CHANGED 的兜底延时
  let headObserver = null;  // 看门狗
  let headTimer = 0;        // 看门狗防抖

  function scheduleMove() {
    // setTimeout 而非 requestAnimationFrame：本脚本跑在隐藏 iframe 里，
    // rAF 在不渲染的文档中可能永不触发，会让搬家链路永久卡死
    if (moveTimer || settings.paused || settings.avatarMode !== 'move' || !isNarrow()) return;
    moveTimer = setTimeout(() => { moveTimer = 0; moveAvatars(); }, 50);
  }

  function setupObserver() {
    const chat = doc.getElementById('chat');
    if (!chat || observer) return;
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type !== 'childList' || !m.addedNodes.length) continue;
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          // 新楼、含楼层的容器，或第三方脚本插回的裸头像列，都要跟进搬家
          if (n.classList.contains('mes')
            || (n.querySelector && n.querySelector('.mes'))
            || (n.closest && n.closest('.mes'))) {
            scheduleMove();
            return;
          }
        }
      }
    });
    observer.observe(chat, { childList: true, subtree: true });
  }

  function bindTavernEvents() {
    // eventOn 的监听在脚本关闭时由酒馆助手自动卸载
    try {
      if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined' && tavern_events.CHAT_CHANGED) {
        eventOn(tavern_events.CHAT_CHANGED, () => {
          clearTimeout(chatChangedTimer);
          chatChangedTimer = setTimeout(scheduleMove, 120);
        });
      }
      if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined' && tavern_events.MORE_MESSAGES_LOADED) {
        eventOn(tavern_events.MORE_MESSAGES_LOADED, scheduleMove); // 上翻加载旧楼的显式兜底
      }
    } catch (e) { /* 非酒馆环境（如本地测试）没有这些全局，忽略 */ }
  }

  function bindScriptButton() {
    // 酒馆助手脚本按钮「防窄化设置」：开/关设置面板。
    // appendInexistentScriptButtons 负责自注册（同名不重复），编辑页「按钮」区也能看到它
    try {
      if (typeof eventOn !== 'function' || typeof getButtonEvent !== 'function') return;
      if (typeof appendInexistentScriptButtons === 'function') {
        appendInexistentScriptButtons([{ name: BUTTON_NAME, visible: true }]);
      }
      eventOn(getButtonEvent(BUTTON_NAME), togglePanel);
    } catch (e) { /* 非酒馆助手环境（如本地测试）忽略 */ }
  }

  // ---------------------------- 设置面板 ----------------------------
  let panel = null;
  let gear = null;

  function togglePanel() {
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (gear) {
      gear.setAttribute('aria-expanded', String(!panel.hidden));
      gear.classList.toggle('mtan-on', !panel.hidden);
    }
  }

  function buildUI() {
    if (!doc.body) return; // 宿主 body 未就绪（极罕见）：跳过面板注入，避免抛错中断后续绑定
    if (settings.showFloatingGear) {
      gear = doc.getElementById(BTN_ID);
      if (!gear) {
        gear = doc.createElement('button');
        gear.id = BTN_ID;
        gear.type = 'button';
        gear.title = '防窄化 · 沉浸全宽 设置';
        gear.setAttribute('aria-label', BUTTON_NAME);
        gear.setAttribute('aria-expanded', 'false');
        gear.innerHTML = GEAR_SVG;
        doc.body.appendChild(gear);
      }
      const anchorCalc = (unit) => 'calc((100' + unit + ' - var(--sheldWidth, 50vw)) / 2 + 8px)';
      const side = settings.buttonSide === 'left' ? 'left' : 'right';
      gear.style[side] = anchorCalc('vw');
      gear.style[side] = anchorCalc('dvw'); // 不支持 dvw 时保留上一条 vw 值
      gear.style[side === 'left' ? 'right' : 'left'] = 'auto';
      gear.addEventListener('click', togglePanel);
    }

    panel = doc.getElementById(PANEL_ID);
    if (!panel) {
      panel = doc.createElement('div');
      panel.id = PANEL_ID;
      panel.hidden = true;
      panel.innerHTML = PANEL_HTML;
      doc.body.appendChild(panel);
    }
    if (settings.showFloatingGear) {
      const anchorCalc = (unit) => 'calc((100' + unit + ' - var(--sheldWidth, 50vw)) / 2 + 8px)';
      const side = settings.buttonSide === 'left' ? 'left' : 'right';
      panel.style[side] = anchorCalc('vw');
      panel.style[side] = anchorCalc('dvw');
      panel.style[side === 'left' ? 'right' : 'left'] = 'auto';
    }

    panel.querySelectorAll('.mtan-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
      const key = pill.closest('.mtan-group').dataset.key;
      const raw = pill.dataset.value;
      settings[key] = key === 'sidePad' ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw;
      onSettingsChanged(key);
      });
    });
    const num = panel.querySelector('.mtan-num');
    let numTimer = 0;
    const commitBreakpoint = () => {
      settings.breakpoint = clampBreakpoint(num.value);
      onSettingsChanged('breakpoint');
    };
    // input（含步进按钮点击）防抖实时生效；change（失焦/回车）兜底
    num.addEventListener('input', () => { clearTimeout(numTimer); numTimer = setTimeout(commitBreakpoint, 350); });
    num.addEventListener('change', commitBreakpoint);
    panel.querySelector('.mtan-reset').addEventListener('click', () => {
      settings = Object.assign({}, DEFAULTS);
      onSettingsChanged('avatarMode');
      syncNarrowState(); // 顺带清掉旧断点监听（isNarrow 现在恒真，只是收尾干净）
    });

    syncPanel();
  }

  function onSettingsChanged(key) {
    saveSettings();
    if (key === 'avatarMode' || key === 'paused') applyAvatarMode();
    if (key === 'narrowOnly' || key === 'breakpoint') syncNarrowState();
    injectStyles(); // 断点/开关/暂停变化都通过重建规则生效
    syncPanel();
  }

  function syncPanel() {
    if (!panel) return;
    panel.querySelectorAll('.mtan-group').forEach((group) => {
      const key = group.dataset.key;
      group.querySelectorAll('.mtan-pill').forEach((pill) => {
        const v = pill.dataset.value;
        pill.classList.toggle('on', String(settings[key]) === v);
      });
    });
    const num = panel.querySelector('.mtan-num');
    num.value = settings.breakpoint;
    num.disabled = !settings.narrowOnly;
  }

  // ---------------------------- 看门狗 ----------------------------
  // 主题/其他脚本在 head 里追加 <style> 或样式表 <link> 后，把我们的规则挪回末尾——
  // 所有规则本就 !important，同优先级比的是顺序，看门狗保证晚注入者盖不掉我们
  function styleSuperseded() {
    const el = doc.getElementById(STYLE_ID);
    if (!el || el.parentElement !== doc.head) return false;
    for (let s = el.nextElementSibling; s; s = s.nextElementSibling) {
      if (s.tagName === 'STYLE' || (s.tagName === 'LINK' && /stylesheet/i.test(s.rel || ''))) return true;
    }
    return false;
  }

  function setupWatchdog() {
    if (headObserver || !doc.head) return;
    headObserver = new MutationObserver(() => {
      if (!styleSuperseded()) return;
      clearTimeout(headTimer);
      headTimer = setTimeout(() => {
        headTimer = 0;
        if (settings.paused) return;
        if (styleSuperseded()) doc.head.appendChild(doc.getElementById(STYLE_ID));
      }, 200);
    });
    headObserver.observe(doc.head, { childList: true });
  }

  // ---------------------------- 生命周期 ----------------------------
  function whenChat(fn) {
    // 酒馆的 #chat 极早于脚本创建；万一没有（极端加载顺序）低频轮询等待。
    // 不设上限：停用/删除脚本时 cleanup 会清掉定时器，不会“复活”搬移
    if (doc.getElementById('chat')) { fn(); return; }
    clearInterval(chatTimer);
    chatTimer = setInterval(() => {
      if (doc.getElementById('chat')) { clearInterval(chatTimer); chatTimer = 0; fn(); }
    }, 200);
  }

  function init() {
    // 清掉热重载/双开残留的旧实例
    [STYLE_ID, UI_STYLE_ID, BTN_ID, PANEL_ID].forEach((id) => { const el = doc.getElementById(id); if (el) el.remove(); });
    if (settings.avatarMode !== 'move' || settings.paused) restoreAvatars(); // 清理上次实例可能残留的搬家

    injectStyles();
    buildUI();
    syncNarrowState();
    whenChat(() => {
      applyAvatarMode();
      setupObserver();
    });
    setupWatchdog();
    bindTavernEvents();
    bindScriptButton();
  }

  function cleanup() {
    if (observer) { observer.disconnect(); observer = null; }
    if (headObserver) { headObserver.disconnect(); headObserver = null; }
    clearTimeout(moveTimer); moveTimer = 0;
    clearTimeout(headTimer); headTimer = 0;
    clearTimeout(chatChangedTimer); chatChangedTimer = 0;
    clearInterval(chatTimer); chatTimer = 0;
    detachMql();
    restoreAvatars(); // 停用/删除脚本时按标记还原头像，无残留
    // 只拆归本实例所有的节点：热重载/双开时，迟到的旧实例 pagehide 不会拆掉新实例的东西
    [STYLE_ID, UI_STYLE_ID, BTN_ID, PANEL_ID].forEach((id) => {
      const el = doc.getElementById(id);
      if (el && el.dataset.mtanOwner === OWNER) el.remove();
    });
  }

  // 官方要求：脚本环境里不要用 DOMContentLoaded，用 jQuery ready；pagehide = 脚本停用钩子
  if (typeof $ === 'function') {
    $(() => init());
  } else if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
  window.addEventListener('pagehide', cleanup, { once: true });
})();
