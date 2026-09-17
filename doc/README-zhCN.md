# Scholar Canvas

**Markdown & Whiteboard for Zotero**

Zotero 中的 Markdown 编辑器与可视化白板

[![Zotero compatibility](https://img.shields.io/badge/Zotero-9%2F10-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![version](https://img.shields.io/badge/version-0.1.7-blue?style=flat-square)](https://github.com/l0o0/bamboo/releases)
[![license](https://img.shields.io/badge/license-AGPL--3.0-orange?style=flat-square)](../LICENSE)

**在 Zotero 中书写 Markdown，用可视化白板连接文献与想法。** 创建、编辑和预览原生 `.md` 附件，并在 `.canvas` 白板上组织文献、摘录和笔记。

[English](../README.md) | [简体中文](README-zhCN.md)

---

## 为什么做这个

Zotero 擅长文献收集与组织。在 AI 时代，**纯 Markdown 文件**才是知识工具之间的通用货币（Obsidian、大模型、静态站点、Git）。

[Better Notes](https://github.com/windingwind/zotero-better-notes) 大幅增强了 Zotero 自带的 **Note**，但那仍然是 Zotero 笔记，不是磁盘上的原生 `.md` 文件。**Scholar Canvas** 补上这块短板：与 Better Notes **互补**、不触碰 Note，让 Markdown 文件成为 Obsidian 与 AI 工作流里直接可用的纯文本。

---

## 功能

- **打开** `.md` / `.markdown` 附件：在主窗口 **Tab** 中打开（不再调系统默认应用）
- **编辑**：内置轻量编辑器——行号、Tab 缩进、字数/字符统计，以及常用 Markdown 语法工具栏快捷按钮（粗体、斜体、标题、链接）
- **预览**：一键切换 Edit / Preview
- **保存**：防抖自动保存 + **Ctrl/Cmd+S**
- **新建 Markdown…**：条目右键菜单（默认 Stored 附件）
- 同时支持 **Stored** 与 **Linked** 附件
- 偏好设置中可关闭打开拦截
- 烤肉串菜单提供文档信息、安全重命名、打开所在文件夹和插件设置
- 可将 Markdown 外链图片导入当前附件的 `assets/` 目录，支持离线使用
- 在 Live 模式下拖拽图片四角调整大小，也可选择预设尺寸或输入像素宽度；通过图片工具条或阅读预览查看原图
- **多屏使用**：Markdown 和 Canvas 均可通过 **更多 → 在独立窗口打开** 或附件右键菜单打开独立窗口，拖到另一块屏幕编辑。通过 **更多 → 返回 Zotero 标签页** 移回主窗口；切换与关闭前会保存内容。

### Canvas 白板

- 新建空白白板，或从 Zotero 分类创建白板
- 将文献拖入画布，从来源卡片中浏览并添加摘录
- 创建笔记、问题、观点、证据和总结卡片，按写作提示开始记录，通过分组框和连线组织想法
- 以 `.canvas` 附件保存白板，并在 Zotero 内重新打开
- 通过内置示例学习操作：包含离线图片、可编辑的 Markdown 附件和配色示范
- 以 1×、2× 或 4× 导出整张白板为 PNG，保留卡片、图片、颜色和连线标签

### 规划中

- Wiki 链接 `[[...]]` 与库内跳转
- YAML frontmatter ↔ Zotero 字段
- PDF 高亮 / 注释导出为 `.md`
- Linked 文件被外部修改时自动 reload
- Markdown Tab 的会话恢复

---

## 安装

从 [Releases](https://github.com/l0o0/bamboo/releases) 下载最新的 `bamboo-v{version}.xpi`，在 Zotero 中：**工具 → 插件 → 齿轮 → 从文件安装插件…**，如有提示重启 Zotero。

### 本地构建

```bash
pnpm install
pnpm run build
# 产物：.scaffold/build/bamboo-v{version}.xpi
```

---

## 使用

1. 选中文献 → 右键 → **新建 Markdown…**  
   会创建 Stored 的 `.md` 附件并打开。
2. 在 Tab 中编辑。输入会自动保存；**Ctrl/Cmd+S** 立即保存。
3. 点 **Preview** 预览，点 **Edit** 回到源码。
4. 之后双击任意 `.md` 附件即可再次打开。
5. 或在 `.md` 附件上右键 → **用 Markdown 编辑器打开**。

点击 Tab 顶部的烤肉串菜单，可以查看文档元数据、重命名、打开所在文件夹，
以及修改 Markdown 专属设置。**导入外链图片**会下载 `http(s)` 图片到当前
附件的 `assets/` 目录，并把 Markdown 引用改为本地路径，文档离线时也能正常显示。

在 **Live** 模式中，单击图片显示大小工具条。拖拽四角可等比例缩放，也可选择 **小 / 中 / 大** 或输入像素宽度。**自适应** 恢复原始尺寸，并限制在正文宽度内。同一图片的不同引用可独立设置大小，原始附件不变；一次撤销即可恢复整次拖拽。

尺寸以 `<img src="assets/figure.png" alt="图像说明" width="480">` 保存到 `.md` 文件中，阅读预览和 HTML 导出会保留宽度，窄窗口中自动适配正文。工具条的 **查看原图** 或阅读预览中的单击图片，会打开临时查看窗口，可在自适应与 100% 之间切换，不改变笔记排版。

也可以把已有 `.md` 拖进 Zotero（或添加链接附件），双击同样由本插件打开。

---

### 白板

1. 选择 **工具 → 新建白板…** 或 **从分类新建白板…**。
2. 将 Zotero 条目拖入画布，浏览摘录并添加笔记。
3. 用分组框整理相关卡片，通过连线梳理论证关系。
4. 从 **工具 → 最近白板** 或 `.canvas` 附件重新打开白板。

选择 **帮助 → Scholar Canvas：创建示例白板** 可生成新版教程和一份 **开始写作.md** 练习本，带你完成一句话总结、待办事项和插图三个练习，了解 Live / 源码模式与保存方式，再回到白板连接证据并导出分享。已有示例白板会保留。

分享时，点击工具栏的 **导出 PNG** 按钮（2×），或右键画布空白处选择 **导出 PNG · 1× / 2× / 4×**。图片包含整张白板及留白，沿用当前主题，不包含编辑控件。超大图片会提示尝试较低分辨率，不会静默降低清晰度。

---

## 环境要求

- Zotero **9** 或 **10**
- 桌面客户端（不支持 Zotero 网页版）

---

## 开发

基于 [zotero-plugin-scaffold](https://github.com/northword/zotero-plugin-scaffold) 与 [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit)。包管理器使用 **pnpm**。

### 环境准备

```bash
# 配置 Zotero 可执行文件 / 开发 profile / 数据目录（见 .env.example）
cp .env.example .env

pnpm install
pnpm start          # 构建并启动 Zotero，支持热重载
```

国内用户：项目 `.npmrc` 已配置 [npmmirror](https://npmmirror.com/) 镜像。

### 常用命令

| 命令                  | 说明                |
| --------------------- | ------------------- |
| `pnpm start`          | 开发模式 + 热重载   |
| `pnpm run build`      | 生产构建 + 类型检查 |
| `pnpm test`           | 插件测试            |
| `pnpm run lint:check` | Prettier + ESLint   |
| `pnpm run lint:fix`   | 自动修复            |

---

## 设置

**编辑 → 设置 → Scholar Canvas**

- **使用 Markdown 编辑器打开 .md 附件** — 关闭后，`.md` 恢复为系统默认程序打开

---

## 供其他插件调用的 API

Scholar Canvas 原名 Bamboo。为兼容已有更新与集成，仓库地址、XPI 文件名、插件 ID、偏好设置键和 `Zotero.Bamboo` API 命名空间继续沿用原有名称。

Scholar Canvas 在 `Zotero.Bamboo.api.markdown` 暴露进程内 API，供其他插件 / MCP 桥接层在 Zotero 内创建与编辑 `.md` 文档。所有方法均为异步、JSON 友好，失败时抛出 `MarkdownApiError`（`error.code` 稳定不变）。

```js
const md = Zotero.Bamboo.api.markdown;

// 列出用户文库中的 markdown 附件
const docs = await md.list({ q: "note" });

// 读取
const { content } = await md.read(docs[0].itemID);

// 在文献条目下创建，然后编辑
const created = await md.create({
  parentItemID: 123,
  initialContent: "# Title",
});
await md.update(created.itemID, { content: "# New\n\nupdated" });

// 只改 frontmatter
await md.patchFrontmatter(created.itemID, {
  set: { tags: ["ai", "draft"] },
  delete: ["old-key"],
});

// 打开 / 强制保存 / 关闭编辑器 Tab
await md.openTab(created.itemID);
await md.flush(created.itemID);
await md.closeTab(tabID);
```

方法：`list`、`stat`、`read`、`create`、`createLinked`、`update`、
`patchFrontmatter`、`rename`、`trash`、`openTab`、`closeTab`、`sessions`、
`flush`、`toHtml`、`render`、`documentTitle`。

错误码：`ITEM_NOT_FOUND`、`NOT_MARKDOWN`、`WRITE_CONFLICT`、
`WRITE_FAILED`、`INVALID_ARGUMENT`、`NOT_OPEN`。

说明：

- 所有写入都走与编辑器相同的持久化路径（写文件、图片资源清理、标题同步、Zotero 文件同步标记）。
- `update` 在编辑器 Tab 存在未保存修改时返回 `WRITE_CONFLICT`——传 `force: true` 可覆盖。
- `rename` 会重命名底层文件；对 linked 附件会直接重命名磁盘上的文件。
- API 版本号：`Zotero.Bamboo.api.version`（当前 `2`）。

---

## 常见问题

**会取代 Better Notes 吗？**  
不会。Better Notes 增强 Zotero Note；Scholar Canvas 管理真正的 **Markdown 文件**和 **Canvas 白板**附件。可以同时安装。

**文件存在哪里？**

- **新建 Markdown…** 创建的是 Zotero storage 下的 **Stored** 附件。
- 也可以添加 **Linked** 附件，指向 Obsidian vault 或任意文件夹。

**会随 Zotero 同步吗？**  
Stored 附件遵循 Zotero 文件同步（若已开启）。Linked 文件不会随 Zotero 文件同步上传。

**识别哪些扩展名？**  
`.md`、`.markdown`、`.mdown`、`.mkd`、`.mkdn`，以及 `text/markdown` 类型。

---

## 贡献

欢迎 Issue 与 PR。较大功能请先开 Issue 对齐范围。

---

## 致谢

- 基于 [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
- [markdown-it](https://github.com/markdown-it/markdown-it)
- 灵感来自 Obsidian 工作流与 Zotero 社区

---

## 许可证

[AGPL-3.0-or-later](../LICENSE)
