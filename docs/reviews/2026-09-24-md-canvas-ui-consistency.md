# Markdown 与白板 UI 一致性复核

日期：2026-09-24。范围：当前工作区，包括刚完成的白板纯图标样式栏。

## 结论

两者已有相同的视觉基础，但尚未形成完全统一的组件规范。Markdown 主工具栏已经使用图标和悬停提示，不需要重复做一次“去文字化”。优先统一图标主题响应、控件尺寸、工具栏表面和菜单规则。

本轮为审查，没有修改产品界面。

## 核查依据与限制

- 检查 Markdown 生产工具栏构造、主题变量、样式、SVG 资源，以及白板生产组件与样式。
- 查看浏览器中运行的生产 Markdown 编辑器正文和双链侧栏；白板参考本轮前已实际验证的深浅色、图标菜单和尺寸菜单。
- `markdown.html` 顶部的 Source、Bold、Save 等文字按钮属于开发测试壳，不是 Zotero 中的正式工具栏，不能据此认定 Markdown 尚未图标化。
- 本轮未运行原生 Windows Zotero；生产工具栏在原生宿主中的最终对比度和窄窗口表现仍需实机复核。

## 已统一的部分

1. 基础色：深色背景 #12141a、面板 #1a1d24、文字 #e8eaed、强调色 #60a5fa 一致；浅色也使用白色面板与蓝色强调。
2. 字体：两者均以系统 UI 字体为主，具有中文字体回退。
3. 图标方向：均以线性图标为主，常用操作具有 title 悬停提示。
4. 功能分层：均有常驻高频功能及更多菜单；保存、撤销、编辑等操作的含义接近。

## 差异与优先级

### P1：Markdown 图标不能随主题和状态正常变色

- Markdown 通过外部 `<img>` 加载 SVG；bold、more、panel-right 等资源内部写死 stroke="#667085"。
- 按钮 CSS 修改父级 color，而 `.zmd-icon` 的 stroke 样式无法改变外部图片内部的固定描边。
- 白板的内联 SVG 使用 currentColor，能够跟随深浅色与活动状态。
- 影响：Markdown 深色模式下图标更暗；悬停或选中时图标颜色与背景状态不一定同步。
- 建议：保留 Zotero 对 SVG 注入的兼容约束，统一为可主题着色的资源呈现方式。不要直接把白板的内联 SVG 方案搬到 XHTML 中；Markdown 资源化加载原本就是为了规避宿主 sanitizer/XML 问题。

依据：src/modules/markdown/icons.ts、addon/content/icons/markdown/*.svg、src/modules/markdown/styles.ts 的 .zmd-icon 和按钮规则；packages/whiteboard/src/whiteboard/icons.tsx。

### P2：按钮密度和工具栏表面不一致

- Markdown 控件为 36/40/44px，图标为 16/18/20px；宽窗口自动增大。
- 白板主工具栏控件为 36px，选中对象的样式栏为 32px。
- Markdown 顶栏有渐变，白板浮动工具栏使用纯色表面。
- 建议：主工具栏以 36px 为共同标准，局部样式栏保留 32px；采用共同的图标视觉尺寸与分隔间距。Markdown 顶栏保持文档布局，但改用统一纯色表面。宽屏优先增加留白，无需同时放大全部按钮。

依据：src/modules/markdown/styles.ts 的 responsiveToolbarSizingCSS、toolbarWidthAlignmentCSS、工具栏/按钮规则；packages/whiteboard/src/whiteboard/board.css。

### P2：更多操作、菜单和焦点状态的细节尚未统一

- Markdown 顶栏更多操作为横向省略号，白板为竖向“⋮”。
- Markdown 按钮圆角为 7px，白板主按钮为 8px、局部按钮为 6px；菜单间距和阴影也分别维护。
- 白板工具栏有明确的 focus-visible 规则；Markdown 主工具栏主要依赖浏览器默认焦点表现，其他区域又有自己的自定义焦点规则。
- 建议：顶部更多入口统一为“⋮”；明确主控件/局部控件两档规格，共用悬停、活动、禁用和键盘焦点规则。不要把所有角色的圆角强行设成同一数值。

依据：src/modules/markdown/tab.ts、src/modules/markdown/icons.ts、src/modules/markdown/styles.ts；packages/whiteboard/src/whiteboard/icons.tsx、board.css。

### P2：主题数据重复维护，后续容易再次分叉

- Markdown 有 THEME_TOKENS，白板主要在 CSS 中维护独立变量。
- 深色普通边框 Markdown 为 #2e3440，白板为 #3d4452；后者正好是 Markdown 的强边框色。
- 这不一定是视觉错误：浮动面板可能需要更强边界。但应由同一套“普通/强边框”语义决定，而非两边各自写色值。
- 建议：共享基础颜色、间距、圆角与阴影规范；保留文档和画布各自的布局、内容样式与组件实现。

依据：src/modules/markdown/theme-tokens.ts；packages/whiteboard/src/whiteboard/board.css 的深色变量。

## 应保留的合理差异

- Markdown：固定文档工具栏、连续阅读区、左侧目录与右侧双链。
- 白板：浮动工具栏、按当前对象出现的样式控件、避让对象的属性面板。
- 线型、箭头等可直接以效果预览的选项适合纯图标；导出、清理图片、文件信息等操作仍应在展开菜单中保留名称。
- 正文排版无需统一到相同字号：Markdown 长文阅读与白板卡片摘要承担不同任务。

## 建议实施顺序

1. 修正 Markdown 图标在深色、悬停和活动状态的着色，并统一更多图标。
2. 统一主工具栏密度、纯色表面与交互状态；核查中英文和窄窗口。
3. 整理共享设计变量，统一弹窗边框、阴影、留白与焦点表现。
4. 在 Windows Zotero 中复核正式工具栏、编辑器 iframe 与两个侧栏，避免仅凭开发测试壳作判断。

## 实施记录

已按本次审核统一：

- 共用 src/ui/theme.ts 的主题值、主控件/局部控件尺寸及菜单阴影；原 Markdown 主题模块保留兼容导出。
- Markdown 外部 SVG 改为 CSS alpha 蒙版，跟随 currentColor 显示浅色、深色、悬停和活动状态，保留安全的 XHTML span 标记。
- 主工具栏统一 36px 控件、18px 图标、纯色背景；白板局部样式栏仍为 32px。
- 更多操作统一竖向省略号，补齐 Markdown 更多菜单的 aria-expanded 状态。
- 统一焦点轮廓、禁用处理和菜单阴影；窄窗口将 Markdown 格式组换行，保持按钮完整可达。

验证：63 组 Markdown/白板相关测试通过，两个 TypeScript 项目检查通过；使用生产 CSS 与真实 SVG 资源的浏览器对照页确认了深浅色与选中着色，360px 窗口下按钮未越出面板。浏览器对照页不是 Zotero 原生宿主，Windows 下 chrome:// 资源作为 CSS 蒙版的最终显示仍需实机复核。
