# 本地模拟验证

不启动酒馆、不装任何扩展，用浏览器复现酒馆移动端的消息行布局，验证脚本效果。

## 复刻的结构（对齐 SillyTavern `style.css` / `index.html` 模板默认值）

- `#sheld` 宽 `--sheldWidth: 85vw` 居中；`#chat` 深色底 + 纵向滚动
- `.mes` flex 行 `padding: 10px 10px 0`；头像列 50px（`.last_mes` 带 `padding-bottom: 50px` 重roll条）
- `.mes_block` 左 10px；`.mes_text` 右 `--mes-right-spacing: 30px`
- 思考折叠块 `margin-right: 30px`（摘要行 `-30px` 负边距）；媒体行 `padding-right: 30px`
- `.swipe_left { left:20px }`、`.swipeRightBlock { right:0 }` 仅末楼
- 两层楼：末楼（iframe + 思考块 + 媒体 + swipe 控件）+ 普通文本楼

## 跑法

```bash
# 仓库根目录
python -m http.server 8791
# 浏览器打开（建议把窗口/设备模拟调到 412px 宽）
http://127.0.0.1:8791/tests/_script_host.html
```

页面每 400ms 把关键计算样式渲染到 `<pre id="out">`：`blockW / iframeW`（应 ≈ 聊天列内容宽 − 留白×2）、
`avatarInNameBar`（搬移成功）、`lastMesPadBottom`（重roll条 54px）、`reasoningMarginR / mediaPadR`（清零后 0px）、
`gearRight`（齿轮锚点，仅悬浮齿轮模式）。

## 内置测试按钮

- **模拟脚本停用(pagehide)**：派发 `pagehide`，验证停用还原——头像回消息行、样式/面板/齿轮全部移除。

## 提示

- 改 `src/mt-antinarrow.js` 后直接刷新页面即可（页面直引 `../src/mt-antinarrow.js`）。
- 要测"拉满全屏"，开面板点「拉满全屏」；要测"仅窄屏"，把断点调到 412 以下观察规则失效。
- 本页只是布局近似，酒馆助手专属 API（`getButtonEvent` 等）在页面里不存在，脚本内已有守卫会自动跳过。
