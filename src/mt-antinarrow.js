/**
 * 防窄化 · 沉浸全宽 (mt-antinarrow)
 * ---------------------------------------------------------------
 * 酒馆助手全局脚本：解决消息楼层被「头像列 + 左右内边距」挤压成中间窄条的问题，
 * 让正文卡、开场页 iframe、思考折叠块、媒体行等一切楼层内容铺满整条聊天列。
 *
 * 原理：不碰任何 iframe——脚本向酒馆宿主文档注入一段 !important CSS，
 * 清零 .mes 左右 10px、.mes_block 左 10px、.mes_text 右 30px（以及思考块/媒体
 * 同源的 30px 右缩进），并把头像列搬进名字栏（若其他脚本已搬过，本脚本自动跳过）。
 *
 * 用法：酒馆助手 → 脚本库 → 全局脚本库 → 导入本 JSON（或新建脚本粘贴本文件）。
 * 打开设置面板：点酒馆助手脚本按钮「防窄化设置」（导入后自动存在；编辑页「按钮」开关
 * 需开启），或在面板里打开侧边悬浮齿轮；点面板以外区域或按 Esc 关闭。
 * 面板：注入 / 头像列 / 消息头疏密 / 聊天列宽 / 阅读上限 / 生效范围 / 重roll条 /
 * 左右留白 / 悬浮齿轮 / 窄屏断点，改动即时生效并自动记忆（localStorage）。
 * 停用/删除脚本时自动还原全部 DOM 与样式，无残留；注入的样式由看门狗保持在文档末尾
 * （被删除或挪出 head 则整体重建），不被晚加载的主题/其他脚本盖掉。
 */
(() => {
  'use strict';

  // =============== 默认配置（面板可改，改完记忆在浏览器，无需改代码） ===============
  const DEFAULTS = {
    paused: false,       // true=急救暂停：不注入 CSS、不搬头像，用于一键排查与其他美化的冲突
    avatarMode: 'move',  // 'move'=头像搬到名字栏 | 'hide'=收起头像列 | 'keep'=保留原样
    widenColumn: false,  // 旧版设置：读入时映射到 columnMode，继续保留便于原设置生效
    columnMode: 'native', // 'native'=不动 | 'reading'=居中阅读 | 'full'=拉满全屏
    readingWidth: 960,   // 居中阅读上限(px)：960 | 1200
    headerDensity: 'standard', // 'standard'=跟随酒馆头像尺寸 | 'compact'=头像最大36px
    narrowOnly: false,   // false=全平台生效 | true=仅窄屏(≤breakpoint)生效（桌面端连头像搬移一起还原）
    swipeStrip: true,    // true=末楼底部预留重roll条(‹ ›不压正文)；宿主带沉浸类布局(.immersive-mode)时自动让位
    breakpoint: 1000,    // narrowOnly=true 时的窄屏断点(px)，与酒馆移动端断点一致
    sidePad: 8,          // 楼层左右留白(px)：0=贴边 | 8=小 | 14=中 | 20=大
    showFloatingGear: false, // false=只用酒馆助手脚本按钮「防窄化设置」开面板 | true=额外显示侧边悬浮齿轮
    buttonSide: 'right', // 悬浮齿轮位置：'right' | 'left'（面板「悬浮齿轮」关/左/右 同时管这两项）
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
  const CLEANUP_KEY = '__mtAntinarrowCleanup';
  let stopped = false;

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
    let saved = {};
    try {
      const raw = host.localStorage.getItem(STORE_KEY);
      if (raw) saved = JSON.parse(raw) || {};
      Object.assign(s, saved);
    } catch (e) { /* 读不到就用默认值 */ }
    s.paused = !!s.paused;
    if (!['move', 'hide', 'keep'].includes(s.avatarMode)) s.avatarMode = DEFAULTS.avatarMode;
    if (!Object.prototype.hasOwnProperty.call(saved, 'columnMode')) s.columnMode = s.widenColumn ? 'full' : 'native';
    if (!['native', 'reading', 'full'].includes(s.columnMode)) s.columnMode = 'native';
    s.widenColumn = s.columnMode === 'full';
    s.readingWidth = Number(s.readingWidth) === 1200 ? 1200 : 960;
    s.headerDensity = s.headerDensity === 'compact' ? 'compact' : 'standard';
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
      '#chat .mes:not(.smallSysMes){padding-left:0!important;padding-right:0!important'
        + ';margin-left:' + pad + 'px!important;margin-right:' + pad + 'px!important'
        + ';width:calc(100% - ' + (pad * 2) + 'px)!important}',
      '#chat .mes:not(.smallSysMes) .mes_block{padding-left:0!important;min-width:0!important}',
      '#chat .mes:not(.smallSysMes) .mes_text{padding:0!important;width:100%!important;max-width:100%!important}',
      'body.documentstyle #chat .mes:not(.smallSysMes) .mes_block{margin-right:0!important}',
      'body.documentstyle #chat .mes:not(.smallSysMes) .mes_text{margin-left:0!important}',
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
      // 原节点留在头像列内，数据更新/显隐仍由酒馆接管；用 contents 参与名字栏网格。
      const bar = 'body:not(.documentstyle) #chat .mes:not(.smallSysMes) .ch_name:has(> .mesAvatarWrapper[' + MOVED_ATTR + '])';
      const av = bar + ' > .mesAvatarWrapper[' + MOVED_ATTR + ']';
      r.push(bar + '{--mtan-avatar-column:auto;--mtan-avatar-gap:10px;display:grid!important'
        + ';grid-template-columns:var(--mtan-avatar-column) minmax(0,1fr) auto!important'
        + ';grid-template-rows:auto auto!important;column-gap:0!important;row-gap:0!important;align-items:center!important}');
      r.push('body.hideChatAvatars ' + bar.slice('body:not(.documentstyle) '.length)
        + '{--mtan-avatar-column:0px;--mtan-avatar-gap:0px}');
      r.push(av + '{display:contents!important}');
      r.push(av + ' > .avatar{grid-column:1!important;grid-row:1 / span 2!important;align-self:center!important'
        + ';margin-right:var(--mtan-avatar-gap)!important;flex:none!important}');
      r.push(bar + ' > :not(.mesAvatarWrapper):not(.mes_buttons):not(.mes_edit_buttons)'
        + '{grid-column:2!important;grid-row:1!important;min-width:0!important}');
      r.push(bar + ' .flex-container{min-width:0!important;max-width:100%}');
      r.push(bar + ' .name_text{min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important;white-space:normal!important}');
      r.push(bar + ' > .mes_buttons{grid-column:3!important;grid-row:1!important;align-self:start!important;min-width:0;flex-wrap:wrap!important;justify-content:flex-end}');
      r.push(bar + ' > .mes_edit_buttons{grid-column:2 / -1!important;grid-row:3!important;min-width:0;flex-wrap:wrap!important;justify-content:flex-end}');
      r.push('body.expandMessageActions ' + bar.slice('body:not(.documentstyle) '.length)
        + ' > .mes_buttons{grid-column:2 / -1!important;grid-row:3!important;flex-wrap:wrap!important}');
      r.push(bar + ' .extraMesButtons{flex-wrap:wrap!important;min-width:0!important;max-width:100%}');
      r.push(av + ' > .mtan-message-meta{grid-column:2 / -1!important;grid-row:2!important'
        + ';display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;min-width:0;line-height:1.35}');
      // 不覆盖 display，尊重原生「AI回复计时 / 楼层 / token」开关；空数据不占位。
      r.push(av + ' > .mtan-message-meta > :is(.mesIDDisplay,.mes_timer,.tokenCounterDisplay)'
        + '{width:auto!important;min-width:0!important;margin:0!important;padding:0!important'
        + ';font-size:calc(var(--mainFontSize,16px) * .75)!important;font-weight:400!important'
        + ';text-align:left!important;white-space:nowrap!important;font-variant-numeric:tabular-nums}');
      r.push(av + ' > .mtan-message-meta > :empty{display:none!important}');
      if (s.headerDensity === 'compact') {
        r.push(av + ' > .avatar,' + av + ' > .avatar img'
          + '{width:min(var(--avatar-base-width,50px),36px)!important;height:min(var(--avatar-base-height,50px),36px)!important}');
      }
    }
    if (s.swipeStrip && s.avatarMode !== 'keep') {
      // 按酒馆实际显示的控件预留：计数器在底部，箭头位于计数器上方。
      // 老楼仅 swipeAllMessages 生效；隐藏按钮不等于隐藏计数器。
      const strip = 'body:not(.immersive-mode) #chat .mes:not(.smallSysMes)';
      const eligible = strip + ':is(.last_mes,body.swipeAllMessages .mes)';
      r.push(strip + '{padding-bottom:0!important}');
      r.push(eligible + ':has(> .swipeRightBlock .swipes-counter:not([hidden]))'
        + '{padding-bottom:calc(var(--swipeCounterHeight,15px) + var(--swipeCounterMargin,5px) + 4px)!important}');
      r.push(eligible + ':is(.swipes_visible:has(> .swipe_left:not([hidden])),.swipes_visible:has(> .swipeRightBlock .swipe_right:not([hidden])),.last_swipe:has(> .swipeRightBlock .swipe_right:not([hidden])))'
        + ':not(body.hideAllSwipeButtons .mes)'
        + '{padding-bottom:calc(25px + var(--swipeCounterHeight,15px) + var(--swipeCounterMargin,5px) + 4px)!important}');
    }
    if (s.columnMode === 'reading') {
      const width = 'min(100dvw,' + s.readingWidth + 'px)';
      r.push(':root{--sheldWidth:' + width + '!important}');
      r.push('#sheld{width:' + width + '!important;max-width:100dvw!important;left:0!important;right:0!important;margin-left:auto!important;margin-right:auto!important}');
    }
    if (s.columnMode === 'full') {
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
      // 浮层与 logprobs 面板（css/logprobs.css 自带同款「两侧空隙一半」塌缩公式）
      // 保留原生 max-width:90dvw 的收边，只补宽度
      r.push('#floatingPrompt,#cfgConfig,#logprobsViewer{width:100vw!important;width:100dvw!important}');
    }
    // 头像放大视图挂着 .draggable 类，同款「两侧空隙一半」宽度公式在拉满后塌缩成
    // min-width:100px 小块并钉在左缘（--leftGapWidth 归零）。只在宽视口修：
    // ≤1000px 酒馆移动端自带 .draggable 全屏展开（style.css 移动块），不能覆盖它。
    // 覆盖 --leftGapWidth 让原生 left 公式自行在整屏内居中，宽度回到 --maxWidth 自然值
    const wideScreenFix = s.columnMode === 'full'
      ? '@media screen and (min-width:1001px){'
        + '.zoomed_avatar{--leftGapWidth:100vw!important;--leftGapWidth:100dvw!important'
        + ';width:var(--maxWidth, 60vh)!important}}'
      : '';
    const body = r.join('\n') + (wideScreenFix ? '\n' + wideScreenFix : '');
    return s.narrowOnly
      ? '@media screen and (max-width:' + s.breakpoint + 'px){\n' + body + '\n}'
      : body;
  }

  const UI_CSS = `
/* 位置由 positionUI 按实际聊天列和可见视口计算，CSS 提供初始落点。 */
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
#mt-antinarrow-panel{box-sizing:border-box;font-family:inherit;font-size:13px;width:min(320px,calc(100dvw - 16px));max-height:calc(100dvh - 32px);right:8px;bottom:12px;padding:12px}
#mt-antinarrow-gear{box-sizing:border-box;width:40px;height:40px;right:8px}
#mt-antinarrow-panel .mtan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
#mt-antinarrow-panel .mtan-title{margin:0;letter-spacing:0}
#mt-antinarrow-panel .mtan-close{font:inherit;font-size:22px;line-height:1;width:36px;height:36px;flex:none;padding:0;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
#mt-antinarrow-panel .mtan-status{opacity:.7;font-size:12px;margin-bottom:12px}
#mt-antinarrow-panel .mtan-row{align-items:flex-start;gap:10px;margin-bottom:10px}
#mt-antinarrow-panel .mtan-lab{line-height:36px}
#mt-antinarrow-panel .mtan-pill{min-height:36px;padding:5px 10px;font-size:13px}
#mt-antinarrow-panel .mtan-num{min-height:36px;width:84px;font-size:14px}
#mt-antinarrow-panel .mtan-reset{min-height:38px}
#mt-antinarrow-panel [hidden]{display:none!important}
#mt-antinarrow-panel button:disabled{opacity:.4;cursor:default}
#mt-antinarrow-panel .mtan-close:hover{background:color-mix(in srgb,currentColor 10%,transparent)}
#mt-antinarrow-panel .mtan-close:focus-visible,#mt-antinarrow-gear:focus-visible{outline:2px solid var(--SmartThemeQuoteColor,#cc9966);outline-offset:2px}
@media(prefers-reduced-motion:reduce){#mt-antinarrow-gear,#mt-antinarrow-panel button{transition:none!important;transform:none!important}}
`;

  const GEAR_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  const PANEL_HTML = `
<div class="mtan-head"><div class="mtan-title" id="mtan-panel-title">防窄化 · 沉浸全宽</div><button type="button" class="mtan-close" aria-label="关闭防窄化设置">×</button></div>
<div class="mtan-status" role="status" aria-live="polite"></div>
<div class="mtan-row"><span class="mtan-lab" title="怀疑与其他美化脚本/主题冲突时切到「暂停」一键隔离验证">注入</span><div class="mtan-group" data-key="paused">
  <button type="button" class="mtan-pill" data-value="false">开</button>
  <button type="button" class="mtan-pill" data-value="true">暂停</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">头像列</span><div class="mtan-group" data-key="avatarMode">
  <button type="button" class="mtan-pill" data-value="move">搬到名字栏</button>
  <button type="button" class="mtan-pill" data-value="hide">收起</button>
  <button type="button" class="mtan-pill" data-value="keep">保留</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">消息头</span><div class="mtan-group" data-key="headerDensity">
  <button type="button" class="mtan-pill" data-value="standard">标准</button>
  <button type="button" class="mtan-pill" data-value="compact">紧凑</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">聊天列宽</span><div class="mtan-group" data-key="columnMode">
  <button type="button" class="mtan-pill" data-value="native">不动</button>
  <button type="button" class="mtan-pill" data-value="reading">居中阅读</button>
  <button type="button" class="mtan-pill" data-value="full">拉满全屏</button>
</div></div>
<div class="mtan-row" data-reading-width><span class="mtan-lab">阅读上限</span><div class="mtan-group" data-key="readingWidth">
  <button type="button" class="mtan-pill" data-value="960">960px</button>
  <button type="button" class="mtan-pill" data-value="1200">1200px</button>
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
<div class="mtan-row"><span class="mtan-lab">悬浮齿轮</span><div class="mtan-group" data-key="gear">
  <button type="button" class="mtan-pill" data-value="off">关</button>
  <button type="button" class="mtan-pill" data-value="left">左</button>
  <button type="button" class="mtan-pill" data-value="right">右</button>
</div></div>
<div class="mtan-row"><span class="mtan-lab">窄屏断点(px)</span><input type="number" class="mtan-num" aria-label="窄屏断点" data-key="breakpoint" min="400" max="2000" step="50"></div>
<button type="button" class="mtan-reset">恢复默认</button>
`;

  function injectStyles() {
    const head = doc.head;
    if (stopped || !head) return;

    let ui = doc.getElementById(UI_STYLE_ID);
    if (!ui) {
      ui = doc.createElement('style');
      ui.id = UI_STYLE_ID;
      ui.dataset.mtanOwner = OWNER;
      ui.textContent = UI_CSS;
    }
    let style = doc.getElementById(STYLE_ID);
    if (ui.parentElement !== head) head.insertBefore(ui, style?.parentElement === head ? style : null);

    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      style.dataset.mtanOwner = OWNER;
    }
    const css = settings.paused ? '' : buildCss(settings);
    if (style.textContent !== css) style.textContent = css;
    if (style.parentElement !== head || (!settings.paused && styleSuperseded(style))) head.appendChild(style);
  }

  // ------------------------ 头像列：搬家 / 还原 ------------------------
  function moveAvatars() {
    if (stopped || settings.paused || settings.avatarMode !== 'move' || !isNarrow() || !doc.body || doc.body.classList.contains('documentstyle')) return;
    // 只搬原生普通楼；其他脚本已搬过的头像、小型系统消息均留在原位。
    doc.querySelectorAll('#chat .mes:not(.smallSysMes) > .mesAvatarWrapper').forEach((av) => {
      const chName = av.parentElement.querySelector('.ch_name');
      if (!chName) return;
      const items = av.querySelectorAll(':scope > .mesIDDisplay, :scope > .mes_timer, :scope > .tokenCounterDisplay');
      if (items.length) {
        const meta = doc.createElement('div');
        meta.className = 'mtan-message-meta';
        av.insertBefore(meta, items[0]);
        items.forEach((item) => meta.appendChild(item));
      }
      av.setAttribute(MOVED_ATTR, OWNER);
      chName.insertBefore(av, chName.firstChild);
    });
  }

  function restoreAvatars() {
    // 只处理带本脚本标记的节点，不影响其他脚本搬移的头像
    doc.querySelectorAll('#chat .mesAvatarWrapper[' + MOVED_ATTR + '="' + OWNER + '"]').forEach((av) => {
      const meta = av.querySelector(':scope > .mtan-message-meta');
      if (meta) meta.replaceWith(...meta.childNodes);
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
    if (stopped) return;
    if (!settings.paused && settings.avatarMode === 'move' && isNarrow() && !doc.body.classList.contains('documentstyle')) moveAvatars();
    else restoreAvatars();
  }

  // ------------------------ 窄屏断点同步（DOM 与 CSS 同一条件） ------------------------
  let mql = null;

  function isNarrow() {
    if (!settings.narrowOnly) return true;
    // mql 由 syncNarrowState 按宿主视口建立（脚本自己的 iframe 视口不是真实窗口），断点变更时随之重建
    return mql ? mql.matches : true;
  }

  function onNarrowChange() {
    if (stopped) return;
    applyAvatarMode();
    syncPanel();
    positionUI();
  }

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
    if (settings.narrowOnly) { // 全平台时无需监听断点
      try {
        mql = host.matchMedia('(max-width:' + settings.breakpoint + 'px)');
        if (mql.addEventListener) mql.addEventListener('change', onNarrowChange);
        else if (mql.addListener) mql.addListener(onNarrowChange);
      } catch (e) { mql = null; }
    }
    // 两种情况都要按新状态重排：仅窄屏 → 全平台时，桌面端先前还原的头像也得重新搬
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
  const eventHandles = [];

  function scheduleMove() {
    // setTimeout 而非 requestAnimationFrame：本脚本跑在隐藏 iframe 里，
    // rAF 在不渲染的文档中可能永不触发，会让搬家链路永久卡死
    if (stopped || moveTimer || settings.paused || settings.avatarMode !== 'move' || !isNarrow()) return;
    moveTimer = setTimeout(() => {
      moveTimer = 0;
      if (!stopped) moveAvatars();
    }, 50);
  }

  function setupObserver() {
    const chat = doc.getElementById('chat');
    if (stopped || !chat || observer) return;
    observer = new MutationObserver((muts) => {
      if (stopped) return;
      for (const m of muts) {
        if (m.type !== 'childList' || !m.addedNodes.length) continue;
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          // 只跟进新楼、含楼层的容器、被插回消息行的裸头像列；
          // 流式输出反复改写 .mes_text 等楼内变动一律忽略，免得每 50ms 全量扫一遍聊天记录
          if (n.classList.contains('mes')
            || (n.classList.contains('mesAvatarWrapper') && n.parentElement && n.parentElement.classList.contains('mes'))
            || n.querySelector('.mes')) {
            scheduleMove();
            return;
          }
        }
      }
    });
    observer.observe(chat, { childList: true, subtree: true });
  }

  function bindTavernEvents() {
    if (stopped || typeof eventOn !== 'function' || typeof tavern_events === 'undefined') return;
    try {
      if (tavern_events.CHAT_CHANGED) {
        eventHandles.push(eventOn(tavern_events.CHAT_CHANGED, () => {
          if (stopped) return;
          clearTimeout(chatChangedTimer);
          chatChangedTimer = setTimeout(() => {
            chatChangedTimer = 0;
            scheduleMove();
          }, 120);
        }));
      }
      if (tavern_events.MORE_MESSAGES_LOADED) {
        eventHandles.push(eventOn(tavern_events.MORE_MESSAGES_LOADED, scheduleMove)); // 上翻加载旧楼的显式兜底
      }
    } catch (e) { /* 非酒馆环境（如本地测试）忽略 */ }
  }

  function bindScriptButton() {
    // 酒馆助手脚本按钮「防窄化设置」：开/关设置面板。
    // appendInexistentScriptButtons 负责自注册（同名不重复），编辑页「按钮」区也能看到它
    try {
      if (stopped || typeof eventOn !== 'function' || typeof getButtonEvent !== 'function') return;
      if (typeof appendInexistentScriptButtons === 'function') {
        appendInexistentScriptButtons([{ name: BUTTON_NAME, visible: true }]);
      }
      eventHandles.push(eventOn(getButtonEvent(BUTTON_NAME), () => {
        if (!stopped) togglePanel();
      }));
    } catch (e) { /* 非酒馆助手环境（如本地测试）忽略 */ }
  }

  // ---------------------------- 设置面板 ----------------------------
  let panel = null;
  let gear = null;
  let numTimer = 0;      // 断点输入防抖
  let returnFocus = null;
  let outsideGesture = false;
  let bodyObserver = null;

  function setPanelOpen(open, restoreFocus = true) {
    if (stopped || !panel) return;
    if (open) returnFocus = doc.activeElement;
    panel.hidden = !open;
    if (gear) {
      gear.setAttribute('aria-expanded', String(open));
      gear.classList.toggle('mtan-on', open);
    }
    if (open) {
      syncPanel();
      positionUI();
      panel.querySelector('.mtan-close').focus({ preventScroll: true });
    } else if (restoreFocus && returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
  }

  function togglePanel() {
    if (stopped || !panel || outsideGesture) return;
    setPanelOpen(panel.hidden);
  }

  function onDocPointerDown(e) {
    outsideGesture = false;
    if (!panel || panel.hidden || panel.contains(e.target) || (gear && gear.contains(e.target))) return;
    // 只忽略同一次外点手势后续的 click，不拦截下一次主动点击。
    outsideGesture = true;
    setPanelOpen(false, false);
  }

  function onDocClick() { outsideGesture = false; }

  function onDocKeyDown(e) {
    outsideGesture = false;
    if (e.key === 'Escape' && panel && !panel.hidden) {
      e.preventDefault();
      setPanelOpen(false);
    }
  }

  function onHostBlur() {
    // iframe 内的 pointerdown 不会冒泡至宿主，失焦后只检查是否转入 iframe。
    if (panel && !panel.hidden && doc.activeElement && doc.activeElement.tagName === 'IFRAME') setPanelOpen(false, false);
  }

  function setupBodyObserver() {
    if (!doc.body || bodyObserver) return;
    let documentMode = doc.body.classList.contains('documentstyle');
    bodyObserver = new MutationObserver(() => {
      if (stopped) return;
      const next = doc.body.classList.contains('documentstyle');
      if (next !== documentMode) {
        documentMode = next;
        applyAvatarMode();
      }
    });
    bodyObserver.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
  }

  // 面板「悬浮齿轮」一行的取值：关 / 左 / 右 对应 showFloatingGear + buttonSide 两项设置
  function gearValue() {
    return settings.showFloatingGear ? settings.buttonSide : 'off';
  }

  function positionUI() {
    if (stopped || !doc.documentElement) return;
    const viewport = host.visualViewport;
    const width = viewport ? viewport.width : doc.documentElement.clientWidth;
    const height = viewport ? viewport.height : host.innerHeight;
    const left = viewport ? viewport.offsetLeft : 0;
    const top = viewport ? viewport.offsetTop : 0;
    const chat = doc.getElementById('sheld');
    const bounds = chat ? chat.getBoundingClientRect() : { left, right: left + width };
    const side = settings.showFloatingGear ? settings.buttonSide : 'right';
    const edge = side === 'left' ? bounds.left + 8 : bounds.right - 8;
    const place = (el, size) => {
      const proposed = side === 'left' ? edge : edge - size;
      el.style.left = Math.max(left + 8, Math.min(left + width - size - 8, proposed)) + 'px';
      el.style.right = 'auto';
    };
    if (gear) {
      place(gear, 40);
      gear.style.bottom = Math.max(12, host.innerHeight - top - height + Math.min(110, height * .18)) + 'px';
    }
    if (panel && !panel.hidden) {
      const panelWidth = Math.min(320, Math.max(0, width - 16));
      const bottom = Math.min(148, height * .2);
      panel.style.width = panelWidth + 'px';
      panel.style.maxHeight = Math.max(0, height - bottom - 16) + 'px';
      panel.style.bottom = Math.max(8, host.innerHeight - top - height + bottom) + 'px';
      place(panel, panelWidth);
    }
  }

  function syncGear() {
    if (!settings.showFloatingGear) {
      if (gear) { gear.remove(); gear = null; }
      positionUI();
      return;
    }
    if (!gear) {
      gear = doc.createElement('button');
      gear.id = BTN_ID;
      gear.type = 'button';
      gear.title = '防窄化 · 沉浸全宽 设置';
      gear.dataset.mtanOwner = OWNER;
      gear.setAttribute('aria-label', BUTTON_NAME);
      gear.setAttribute('aria-expanded', String(!!panel && !panel.hidden));
      gear.classList.toggle('mtan-on', !!panel && !panel.hidden);
      gear.innerHTML = GEAR_SVG;
      gear.addEventListener('click', togglePanel);
      doc.body.appendChild(gear);
    }
    positionUI();
  }

  function buildUI() {
    if (!doc.body) return; // 宿主 body 未就绪（极罕见）：跳过面板注入，避免抛错中断后续绑定
    panel = doc.createElement('div');
    panel.id = PANEL_ID;
    panel.dataset.mtanOwner = OWNER;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'mtan-panel-title');
    panel.hidden = true;
    panel.innerHTML = PANEL_HTML;
    doc.body.appendChild(panel);
    syncGear();

    panel.querySelectorAll('.mtan-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        if (stopped) return;
        const key = pill.closest('.mtan-group').dataset.key;
        const raw = pill.dataset.value;
        if (key === 'gear') {
          settings.showFloatingGear = raw !== 'off';
          if (raw !== 'off') settings.buttonSide = raw;
        } else {
          settings[key] = key === 'sidePad' || key === 'readingWidth' ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw;
          if (key === 'columnMode') settings.widenColumn = raw === 'full';
        }
        onSettingsChanged(key);
      });
    });
    const num = panel.querySelector('.mtan-num');
    const commitBreakpoint = () => {
      if (stopped) return;
      clearTimeout(numTimer); numTimer = 0;
      settings.breakpoint = clampBreakpoint(num.value);
      onSettingsChanged('breakpoint');
    };
    // input（含步进按钮点击）只在数值已合法时防抖实时生效，输入到一半（如想输 800 刚打出 8、或清空重输）
    // 不提交，否则会被夹成 400 回写进框里；change（失焦/回车）兜底，非法值届时再夹取
    num.addEventListener('input', () => {
      clearTimeout(numTimer); numTimer = 0;
      const v = Number(num.value);
      if (num.value === '' || v < 400 || v > 2000) return;
      numTimer = setTimeout(commitBreakpoint, 350);
    });
    num.addEventListener('change', commitBreakpoint);
    panel.querySelector('.mtan-reset').addEventListener('click', () => {
      if (stopped) return;
      settings = Object.assign({}, DEFAULTS);
      onSettingsChanged('reset');
    });
    panel.querySelector('.mtan-close').addEventListener('click', () => setPanelOpen(false));
    doc.addEventListener('pointerdown', onDocPointerDown, true);
    doc.addEventListener('click', onDocClick);
    doc.addEventListener('keydown', onDocKeyDown);
    host.addEventListener('blur', onHostBlur);
    host.addEventListener('resize', positionUI);
    if (host.visualViewport) host.visualViewport.addEventListener('resize', positionUI);
    setupBodyObserver();
    syncPanel();
  }

  function onSettingsChanged(key) {
    if (stopped) return;
    const all = key === 'reset';
    saveSettings();
    if (all || key === 'narrowOnly' || key === 'breakpoint') syncNarrowState(); // 内含按新断点重排头像
    else if (key === 'avatarMode' || key === 'paused') applyAvatarMode();
    if (all || key === 'gear') syncGear();
    if (key !== 'gear') injectStyles();
    syncPanel();
    positionUI();
  }

  function syncPanel() {
    if (!panel) return;
    panel.querySelectorAll('.mtan-group').forEach((group) => {
      const key = group.dataset.key;
      const cur = key === 'gear' ? gearValue() : String(settings[key]);
      group.querySelectorAll('.mtan-pill').forEach((pill) => {
        const selected = cur === pill.dataset.value;
        pill.classList.toggle('on', selected);
        pill.setAttribute('aria-pressed', String(selected));
        pill.disabled = key === 'headerDensity' && settings.avatarMode !== 'move';
      });
    });
    const num = panel.querySelector('.mtan-num');
    num.value = settings.breakpoint;
    num.disabled = !settings.narrowOnly;
    panel.querySelector('[data-reading-width]').hidden = settings.columnMode !== 'reading';
    panel.querySelector('.mtan-status').textContent = settings.paused ? '已暂停，布局已还原'
      : !isNarrow() ? '未生效：当前超出窄屏范围'
      : '生效中' + (settings.narrowOnly ? '，仅限 ≤' + settings.breakpoint + 'px' : '，全平台');
  }

  // ---------------------------- 看门狗 ----------------------------
  // 晚加载的样式表可能盖住布局规则；暂停时只维护样式节点，不争布局规则顺序。
  function styleSuperseded(style) {
    for (let s = style.nextElementSibling; s; s = s.nextElementSibling) {
      if (s.tagName === 'STYLE' || (s.tagName === 'LINK' && /stylesheet/i.test(s.rel || ''))) return true;
    }
    return false;
  }

  function stylesNeedRepair() {
    if (stopped) return false;
    const head = doc.head;
    const ui = doc.getElementById(UI_STYLE_ID);
    const style = doc.getElementById(STYLE_ID);
    return !!head && (ui?.parentElement !== head || style?.parentElement !== head
      || (!settings.paused && styleSuperseded(style)));
  }

  function setupWatchdog() {
    if (stopped || headObserver || !doc.head) return;
    headObserver = new MutationObserver(() => {
      if (!stylesNeedRepair()) return;
      clearTimeout(headTimer);
      headTimer = setTimeout(() => {
        headTimer = 0;
        if (stylesNeedRepair()) injectStyles();
      }, 200);
    });
    headObserver.observe(doc.head, { childList: true });
  }

  // ---------------------------- 生命周期 ----------------------------
  function whenChat(fn) {
    // 酒馆的 #chat 极早于脚本创建；万一没有（极端加载顺序）低频轮询等待。
    // 不设上限：停用/删除脚本时 cleanup 会清掉定时器，不会“复活”搬移
    if (stopped) return;
    if (doc.getElementById('chat')) { fn(); return; }
    clearInterval(chatTimer);
    chatTimer = setInterval(() => {
      if (stopped || !doc.getElementById('chat')) return;
      clearInterval(chatTimer);
      chatTimer = 0;
      fn();
    }, 200);
  }

  function init() {
    if (stopped) return;
    injectStyles();
    buildUI();
    const chatReady = !!doc.getElementById('chat');
    syncNarrowState();
    whenChat(() => {
      if (!chatReady) moveAvatars();
      setupObserver();
    });
    setupWatchdog();
    bindTavernEvents();
    bindScriptButton();
  }

  function cleanup() {
    if (stopped) return;
    stopped = true;
    if (host[CLEANUP_KEY] === cleanup) delete host[CLEANUP_KEY];
    window.removeEventListener('pagehide', cleanup);
    doc.removeEventListener('DOMContentLoaded', init);
    if (observer) { observer.disconnect(); observer = null; }
    if (headObserver) { headObserver.disconnect(); headObserver = null; }
    clearTimeout(moveTimer); moveTimer = 0;
    clearTimeout(headTimer); headTimer = 0;
    clearTimeout(chatChangedTimer); chatChangedTimer = 0;
    clearInterval(chatTimer); chatTimer = 0;
    clearTimeout(numTimer); numTimer = 0;
    // 热重载时旧 iframe 可能还没关闭，不能只等酒馆助手自动卸载。
    for (const handle of eventHandles) {
      try { handle.stop(); } catch (e) { /* 不影响其余清理 */ }
    }
    eventHandles.length = 0;
    doc.removeEventListener('pointerdown', onDocPointerDown, true);
    doc.removeEventListener('keydown', onDocKeyDown);
    detachMql();
    if (bodyObserver) { bodyObserver.disconnect(); bodyObserver = null; }
    doc.removeEventListener('click', onDocClick);
    host.removeEventListener('blur', onHostBlur);
    host.removeEventListener('resize', positionUI);
    if (host.visualViewport) host.visualViewport.removeEventListener('resize', positionUI);
    restoreAvatars(); // 停用/删除脚本时按标记还原头像，无残留
    [STYLE_ID, UI_STYLE_ID, BTN_ID, PANEL_ID].forEach((id) => {
      const el = doc.getElementById(id);
      if (el && el.dataset.mtanOwner === OWNER) el.remove();
    });
  }

  // 先停旧实例，即使它还在等 ready 或 pagehide。
  host[CLEANUP_KEY]?.();
  host[CLEANUP_KEY] = cleanup;
  window.addEventListener('pagehide', cleanup, { once: true });
  // 官方要求：脚本环境里用 jQuery ready，不用 DOMContentLoaded。
  if (typeof $ === 'function') {
    $(() => init());
  } else if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
