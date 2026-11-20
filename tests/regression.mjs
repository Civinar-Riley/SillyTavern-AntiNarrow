// 原生规则保持最小集合；场景在独立 iframe 中运行，脚本仍从隐藏子 iframe 注入宿主。
const STORE_KEY = 'mtAntiNarrow.settings.v1';
const stage = document.getElementById('stage');
const results = document.getElementById('results');
const summary = document.getElementById('summary');
const runButton = document.getElementById('run');
const source = await fetch('../src/mt-antinarrow.js').then((r) => {
  if (!r.ok) throw new Error('无法读取待测源码');
  return r.text();
});
const nativeCss = `
*{box-sizing:border-box}:root{--sheldWidth:50vw;--avatar-base-width:50px;--avatar-base-height:50px;--swipeCounterHeight:15px;--swipeCounterMargin:5px;--mainFontSize:16px}body{margin:0;background:#202126;color:#ddd;font:16px sans-serif}#sheld{position:relative;width:var(--sheldWidth);margin:0 auto}#chat{overflow:auto}.mes{position:relative;display:flex;align-items:flex-start;padding:10px 10px 0;width:100%}.mesAvatarWrapper{flex:none}.last_mes .mesAvatarWrapper{padding-bottom:50px}.avatar{width:50px;height:50px;background:#48536c;border-radius:8px}.avatar img{width:50px;height:50px}.mes_block{width:100%;padding-left:10px;overflow-x:hidden}.mes_text{padding-right:30px;overflow-wrap:anywhere}.ch_name,.flex-container{display:flex;gap:3px;flex-wrap:wrap}.ch_name{justify-content:space-between;min-height:22px}.flex1{flex:1}.name_text{font-weight:bold}.mes_buttons,.extraMesButtons,.mes_edit_buttons{display:flex;gap:5px;flex-wrap:nowrap}.extraMesButtons,.mes_edit_buttons{display:none}.menu_button{height:32px;aspect-ratio:1}.timestamp{font-size:10px}.mesIDDisplay,.mes_timer,.tokenCounterDisplay{text-align:center;opacity:.7}.swipe_left,.swipe_right{width:25px;height:25px;display:flex}.swipe_left{position:absolute;bottom:20px;left:20px}.swipeRightBlock{position:absolute;bottom:0;right:0;display:flex;flex-direction:column}.swipes-counter{height:15px;margin-bottom:5px}.smallSysMes{padding:5px!important}.smallSysMes .mesAvatarWrapper,.smallSysMes .ch_name{display:none}body.no-timer .mes_timer,body.no-tokenCount .tokenCounterDisplay,body.no-mesIDDisplay .mesIDDisplay,body.hideChatAvatars .avatar{display:none!important}body.hideChatAvatars .last_mes:not(.smallSysMes){padding-bottom:20px!important}body.documentstyle .mes_block{margin-right:30px}body.documentstyle .mes_text{margin-left:20px}body.documentstyle .mesAvatarWrapper,body.documentstyle .name_text,body.documentstyle .timestamp{display:none!important}body.documentstyle .ch_name{min-height:unset}body:not(.swipeAllMessages) .mes:not(.last_mes) :is(.swipe_left,.swipe_right,.swipes-counter),.mes:not(.swipes_visible) .swipe_left,.mes:not(.swipes_visible,.last_swipe) .swipe_right,body.hideAllSwipeButtons :is(.swipe_left,.swipe_right),.swipes-counter[hidden],.swipe_right[hidden],.swipe_left[hidden]{visibility:hidden;opacity:0;pointer-events:none}body.expandMessageActions .extraMesButtons{display:flex}.zoomed_avatar{width:100px;--leftGapWidth:20px}@media(max-width:1000px){#sheld{width:100dvw}}
`;
function message(id, classes = '') {
  return `<div class="mes ${classes}" mesid="${id}"><div class="mesAvatarWrapper"><div class="avatar" title="头像"></div><div class="mesIDDisplay">#${id}</div><div class="mes_timer" title="计时">28.4s</div><div class="tokenCounterDisplay">2048t</div></div><div class="swipe_left">‹</div><div class="mes_block"><div class="ch_name"><div class="flex-container flex1"><div class="flex-container"><span class="name_text">苏小桃</span><small class="timestamp">14:32</small></div></div><div class="mes_buttons"><span>…</span><div class="extraMesButtons">${'<span class="menu_button">◇</span>'.repeat(9)}</div><span>✎</span></div><div class="mes_edit_buttons">${'<span class="menu_button">✓</span>'.repeat(7)}</div></div><div class="mes_text">测试正文，保持完整宽度。</div></div><div class="swipeRightBlock"><span class="swipe_right">›</span><span class="swipes-counter">1/2</span></div></div>`;
}
const wait = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(condition, message) { if (!condition) throw new Error(message); }
function close(a, b, tolerance = 1) { return Math.abs(a - b) <= tolerance; }
function rect(el) { return el.getBoundingClientRect(); }
function css(el) { return el.ownerDocument.defaultView.getComputedStyle(el); }
let instances = [];
async function mount(settings = {}, width = 360, classes = '') {
  stage.style.width = width + 'px';
  stage.style.maxWidth = 'none';
  const loaded = new Promise((resolve) => stage.addEventListener('load', resolve, { once: true }));
  stage.srcdoc = `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${nativeCss}</style><body class="${classes}"><button id="open" type="button">防窄化设置</button><div id="sheld"><div id="chat">${message(1)}${message(2, 'last_mes swipes_visible')}${message(3, 'smallSysMes')}</div></div><div class="zoomed_avatar"></div></body></html>`;
  await loaded;
  const doc = stage.contentDocument;
  instances = [];
  localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  await startInstance(doc);
  return doc;
}
async function startInstance(doc) {
  const frame = doc.createElement('iframe');
  frame.hidden = true;
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.srcdoc = '<!doctype html><html><body></body></html>';
  doc.body.appendChild(frame);
  await loaded;
  const win = frame.contentWindow;
  const events = new Map();
  win.eventOn = (name, fn) => {
    if (!events.has(name)) events.set(name, new Set());
    events.get(name).add(fn);
    return { stop: () => events.get(name).delete(fn) };
  };
  win.getButtonEvent = (name) => name;
  win.tavern_events = { CHAT_CHANGED: 'CHAT_CHANGED', MORE_MESSAGES_LOADED: 'MORE_MESSAGES_LOADED' };
  const script = win.document.createElement('script');
  script.textContent = source;
  win.document.body.appendChild(script);
  const instance = { frame, win, events };
  instances.push(instance);
  doc.getElementById('open').onclick = () => events.get('防窄化设置')?.forEach((fn) => fn());
  await wait();
  return instance;
}
function clickSetting(doc, key, value) {
  const button = doc.querySelector(`[data-key="${key}"] [data-value="${value}"]`);
  assert(button, `缺少设置 ${key}=${value}`);
  button.click();
}
const cases = [
  ['标准横排、原节点更新、小型系统消息保持原位', async () => {
    const doc = await mount();
    const mes = doc.querySelector('.last_mes');
    const av = mes.querySelector('.ch_name > .mesAvatarWrapper');
    assert(av, '头像未搬入名字栏');
    const items = [...av.querySelector('.mtan-message-meta').children];
    assert(items.every((item) => close(rect(item).y, rect(items[0]).y)), '三项信息没有横排');
    items[1].textContent = '125.6s'; items[2].textContent = '16384t';
    assert(av.querySelector('.mes_timer') === items[1], '计时节点被替换');
    assert(doc.querySelector('.smallSysMes > .mesAvatarWrapper'), '小型系统消息被搬移');
    assert(css(doc.querySelector('.smallSysMes')).paddingLeft === '5px', '系统消息留白被覆盖');
  }],
  ['文档模式进入和退出时还原、重新搬移且正文不越界', async () => {
    const doc = await mount();
    doc.body.classList.add('documentstyle'); await wait();
    const mes = doc.querySelector('.last_mes');
    assert(mes.querySelector(':scope > .mesAvatarWrapper'), '文档模式未还原头像');
    const block = mes.querySelector('.mes_block'), text = mes.querySelector('.mes_text');
    assert(css(block).marginRight === '0px' && css(text).marginLeft === '0px', '文档模式缩进未清零');
    assert(rect(text).right <= rect(block).right + 1, '正文超出父容器');
    doc.body.classList.remove('documentstyle'); await wait();
    assert(mes.querySelector('.ch_name > .mesAvatarWrapper'), '退出文档模式后未重新搬移');
  }],
  ['隐藏头像和全部信息后没有头像空列及信息空行', async () => {
    const doc = await mount({}, 360, 'hideChatAvatars no-timer no-tokenCount no-mesIDDisplay');
    const mes = doc.querySelector('.last_mes'), bar = mes.querySelector('.ch_name');
    const name = mes.querySelector('.name_text');
    assert(close(rect(name).left, rect(bar).left), '隐藏头像后仍有空列');
    assert(rect(mes.querySelector('.mtan-message-meta')).height < 1, '全部信息隐藏后仍占高度');
  }],
  ['紧凑头像、长名字及展开操作栏不越界', async () => {
    const doc = await mount({ headerDensity: 'compact' }, 320, 'expandMessageActions');
    const mes = doc.querySelector('.last_mes'), bar = mes.querySelector('.ch_name');
    mes.querySelector('.name_text').textContent = 'LongCharacterNameWithoutAnySpaces'.repeat(3);
    await wait();
    assert(close(rect(mes.querySelector('.avatar')).width, 36), '紧凑头像不是36px');
    assert(bar.scrollWidth <= bar.clientWidth + 1, '长名字或操作栏越界');
    const actions = mes.querySelector('.mes_edit_buttons');
    mes.querySelector('.mes_buttons').style.display = 'none'; actions.style.display = 'flex';
    await wait();
    assert(rect(actions).right <= rect(bar).right + 1 && actions.scrollWidth <= actions.clientWidth + 1, '编辑操作栏越界');
  }],
  ['重roll箭头、计数器及旧楼分别预留，无控件时无空带', async () => {
    const doc = await mount(); const mes = doc.querySelector('.last_mes');
    assert(parseFloat(css(mes).paddingBottom) >= 49, '箭头空带不足');
    doc.body.classList.add('hideAllSwipeButtons');
    assert(close(parseFloat(css(mes).paddingBottom), 24), '仅计数器空带不正确');
    mes.querySelector('.swipes-counter').hidden = true;
    assert(close(parseFloat(css(mes).paddingBottom), 0), '全部隐藏后仍有空带');
    doc.body.classList.remove('hideAllSwipeButtons'); mes.classList.remove('swipes_visible'); mes.classList.add('last_swipe');
    assert(parseFloat(css(mes).paddingBottom) >= 49, 'last_swipe箭头缺少空带');
    doc.body.classList.add('swipeAllMessages');
    assert(parseFloat(css(doc.querySelector('.mes')).paddingBottom) >= 24, '旧楼计数器缺少空带');
  }],
  ['阅读宽度960/1200及旧版全屏设置保持可用', async () => {
    let doc = await mount({ columnMode: 'reading', readingWidth: 960 }, 1440);
    assert(close(rect(doc.getElementById('sheld')).width, 960), '960px阅读宽度不正确');
    clickSetting(doc, 'readingWidth', 1200);
    assert(close(rect(doc.getElementById('sheld')).width, 1200), '1200px阅读宽度不正确');
    stage.style.width = '360px'; await wait();
    assert(rect(doc.getElementById('sheld')).width <= 360, '手机阅读宽度溢出');
    doc = await mount({ widenColumn: true }, 1440);
    assert(close(rect(doc.getElementById('sheld')).width, 1440), '旧版全屏设置未保留');
  }],
  ['仅窄屏下桌面布局和头像放大均不被覆盖', async () => {
    const doc = await mount({ columnMode: 'full', narrowOnly: true, breakpoint: 1000 }, 1440);
    assert(doc.querySelector('.last_mes > .mesAvatarWrapper'), '桌面仍搬移头像');
    assert(close(rect(doc.querySelector('.zoomed_avatar')).width, 100), '桌面放大视图仍被覆盖');
    stage.style.width = '360px';
    const deadline = performance.now() + 2000;
    while (!doc.querySelector('.last_mes .ch_name > .mesAvatarWrapper') && performance.now() < deadline) await wait(50);
    assert(doc.querySelector('.last_mes .ch_name > .mesAvatarWrapper'), '跨入窄屏未搬移；视口=' + doc.defaultView.innerWidth + '，匹配=' + doc.defaultView.matchMedia('(max-width:1000px)').matches);
  }],
  ['手机和横屏面板不出界，关闭后可立即重新打开', async () => {
    const doc = await mount(); const open = doc.getElementById('open');
    open.focus(); open.click();
    let panel = doc.getElementById('mt-antinarrow-panel');
    assert(!panel.hidden, '面板未打开');
    assert(rect(panel).left >= 0 && rect(panel).right <= 360, '面板横向出界');
    stage.style.height = '320px'; stage.style.width = '640px';
    const deadline = performance.now() + 2000;
    while ((rect(panel).top < 0 || rect(panel).bottom > 320) && performance.now() < deadline) await wait(50);
    assert(rect(panel).top >= 0 && rect(panel).bottom <= 320, '横屏面板纵向出界：' + JSON.stringify({ top: rect(panel).top, bottom: rect(panel).bottom, viewport: doc.defaultView.innerHeight }));
    panel.querySelector('.mtan-close').click();
    assert(panel.hidden && doc.activeElement === open, '关闭未返回焦点');
    open.click(); assert(!panel.hidden, '关闭后无法立即打开');
    stage.style.height = '640px';
  }],
  ['实例接管停止旧订阅，旧pagehide不拆新布局，停用不复活', async () => {
    const doc = await mount(); const old = instances[0];
    const next = await startInstance(doc);
    assert([...old.events.values()].every((set) => set.size === 0), '旧实例订阅未停止');
    old.win.dispatchEvent(new Event('pagehide')); await wait();
    assert(doc.querySelector('.last_mes .ch_name > .mesAvatarWrapper'), '旧清理还原了新头像');
    next.win.dispatchEvent(new Event('pagehide')); await wait(250);
    assert(!doc.getElementById('mt-antinarrow-style') && !doc.querySelector('.mtan-message-meta'), '停用后有样式或信息容器残留');
    assert(doc.querySelector('.last_mes > .mesAvatarWrapper > .mes_timer'), '停用未还原计时节点');
    doc.getElementById('chat').insertAdjacentHTML('beforeend', message(4)); await wait();
    assert(doc.querySelector('[mesid="4"] > .mesAvatarWrapper'), '停用后观察器仍在搬移');
  }],
  ['新消息可搬移；无关设置不重搬，暂停时UI样式可恢复', async () => {
    const doc = await mount(); const av = doc.querySelector('.last_mes .mesAvatarWrapper');
    let moves = 0; const observer = new MutationObserver((muts) => {
      moves += muts.filter((m) => [...m.addedNodes, ...m.removedNodes].includes(av)).length;
    }); observer.observe(doc.getElementById('chat'), { childList: true, subtree: true });
    clickSetting(doc, 'sidePad', 14); clickSetting(doc, 'headerDensity', 'compact'); await wait();
    observer.disconnect(); assert(moves === 0, '留白或疏密设置重搬头像');
    doc.getElementById('chat').insertAdjacentHTML('beforeend', message(4)); await wait();
    assert(doc.querySelector('[mesid="4"] .ch_name > .mesAvatarWrapper'), '新消息未搬移');
    clickSetting(doc, 'paused', true);
    doc.getElementById('mt-antinarrow-ui-style').remove(); await wait(350);
    assert(doc.getElementById('mt-antinarrow-ui-style'), '暂停时UI样式未恢复');
    assert(doc.getElementById('mt-antinarrow-style').textContent === '', '暂停时重新注入布局');
  }],
];
runButton.addEventListener('click', async () => {
  runButton.disabled = true; results.replaceChildren();
  const previous = localStorage.getItem(STORE_KEY);
  let passed = 0;
  try {
    for (const [name, test] of cases) {
      summary.textContent = '检查：' + name;
      const item = document.createElement('li'); results.appendChild(item);
      try { await test(); item.textContent = '通过：' + name; item.className = 'pass'; passed++; }
      catch (error) { item.textContent = '失败：' + name + '；' + error.message; item.className = 'fail'; }
    }
  } finally {
    stage.contentWindow?.__mtAntinarrowCleanup?.();
    if (previous === null) localStorage.removeItem(STORE_KEY); else localStorage.setItem(STORE_KEY, previous);
    summary.textContent = `${passed}/${cases.length} 项通过`;
    summary.dataset.complete = 'true'; summary.dataset.failed = String(cases.length - passed);
    runButton.disabled = false;
  }
});
