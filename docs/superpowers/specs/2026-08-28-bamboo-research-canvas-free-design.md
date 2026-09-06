# Bamboo Research Canvas 免费版设计

- 日期：2026-08-28
- 状态：已确认
- 修订：独立的 Question 与 Claim 节点类型已由
  `2026-09-06-unified-note-templates-design.md` 中的统一 Note 与模板方案取代。
- 范围：免费、local-first 的 Research Canvas
- 不包含：商业化、账号、订阅、云端服务的具体设计

## 1. 背景

Bamboo 当前为 Zotero 提供原生 Markdown 附件能力。用户可以在 Zotero 中创建、打开、编辑、预览和保存真实的 `.md` 文件。

Research Canvas 是 Bamboo 的下一项核心能力。它不替代 Markdown 编辑器，也不试图成为通用白板，而是把 Zotero 文献、PDF 批注、研究问题、用户观点和证据关系放入同一个空间中。

本设计取代旧方案中的产品范围和商业化章节。旧方案中关于 Zotero 数据源、local-first、语义化研究对象以及“阅读—摘录—摆放—连接—思考”的核心方向继续保留。

当前优先级是先把免费版本做好。账号、许可、订阅、团队套餐、云同步和付费功能不属于本设计的决策范围。

## 2. 产品定义

> Bamboo Research Canvas 是 Zotero 中用于组织文献、摘录、观点和研究问题的空间化研究工作台。

它帮助研究者回答：

- 这些文献之间有什么关系？
- 哪些摘录支持或反驳某个观点？
- 当前研究问题还缺少什么证据？
- 阅读过程中产生的想法应该放在哪里？

Research Canvas 不是：

- 通用绘图或流程图软件；
- 自动替用户组织全部知识的 AI 白板；
- Zotero 条目和 PDF 批注的另一个数据库；
- 必须注册、联网或上传资料后才能使用的服务。

## 3. 目标用户与成功标准

### 3.1 目标用户

首版服务个人研究者，包括研究生、教师、独立研究者和需要进行文献比较、问题梳理或证据组织的专业用户。

首版以 Zotero Desktop 为运行环境，不承诺手机、平板或浏览器端编辑。

### 3.2 核心成功标准

用户应当能够在一个画布中完成下面的闭环：

```text
创建画布
  → 拖入多篇 Zotero 文献
  → 打开其中一篇 PDF
  → 将批注加入当前画布
  → 创建一个 Claim
  → 用 supports 连接摘录与 Claim
  → 添加另一篇文献的反例
  → 用 contradicts 连接
  → 关闭并重新打开画布
```

成功不以图形工具数量衡量，而以下列结果衡量：

- 文献和批注能够顺畅进入画布；
- 每个来源卡片都能可靠返回 Zotero 原始位置；
- 用户可以自由摆放，也可以按需要建立研究结构；
- 关闭 Zotero 后重新打开，内容和布局完整恢复；
- Zotero 元数据变化不会破坏用户写下的观点和关系；
- 来源删除后，已经形成的研究结构仍然可读。

## 4. 产品原则

### 4.1 免费、local-first

核心工作流无需：

- 注册 Bamboo 账号；
- 连接 Bamboo 服务器；
- 购买许可证；
- 上传 PDF、批注或画布数据。

用户拥有自己的 `.canvas` 文件，可以复制、备份和迁移。

### 4.2 Zotero 是来源事实

文献标题、作者、年份、标签、附件和批注来自 Zotero。Canvas 不维护第二套完整文献数据库。

Canvas 负责保存：

- 节点位置和尺寸；
- 分组与视口；
- Note、Question 和 Claim；
- 卡片之间的研究关系；
- Zotero 来源引用；
- 用于失效降级的最小显示快照。

### 4.3 自由优先，结构可选

用户可以只把卡片放在空间中，也可以使用 Frame 和语义连线建立结构。产品不要求用户先设计分类体系或填写复杂表单。

### 4.4 人负责判断

Research Canvas 的核心是帮助用户思考，而不是替用户下结论。首版没有自动聚类、自动生成关系或自动生成整张画布。

### 4.5 文件格式独立于渲染引擎

`@xyflow/react` 负责画布交互和渲染，但 React Flow 的内部状态不是持久化格式。文件保存为 JSON Canvas 兼容数据，并增加命名明确的 Bamboo 扩展字段。

## 5. 设计方案选择

设计阶段比较了三种范围：

1. 通用白板优先：先实现形状、自由绘图和流程图能力。
2. 研究闭环优先：先实现文献、批注、观点、问题和证据关系。
3. 完整工作台优先：首版同时实现多视图、Markdown 深度联动、导出和高级检索。

最终选择第二种。

通用白板不能充分体现 Zotero 集成价值；完整工作台会同时引入过多子系统。研究闭环优先能够用最少功能验证 Research Canvas 的核心价值。

## 6. 核心对象模型

### 6.1 Literature

Literature 表示 Zotero 中的一条文献记录。

卡片默认显示：

- 标题；
- 第一作者或简化作者信息；
- 年份；
- 期刊或出版物；
- 少量标签；
- PDF 批注数量。

支持的操作：

- 在 Zotero 中定位；
- 打开默认 PDF；
- 查看该文献的批注；
- 将批注加入当前画布。

### 6.2 Quote

Quote 表示 Zotero PDF Annotation。

卡片显示：

- 摘录文本；
- 作者与年份；
- 页码；
- 可选的批注颜色提示。

Quote 必须保存足够的来源信息，以便返回具体 PDF 批注。颜色只作为小面积来源提示，不作为整张卡片的大面积背景。

### 6.3 Note

Note 是保存在画布文件中的轻量 Markdown 文本，用于快速记录用户想法。

首版 Note 不自动创建 Zotero Note 或 `.md` 文件，也不与外部 Markdown 文档双向同步。

### 6.4 Question

Question 表示尚未解决的研究问题。它和普通 Note 分开，以便用户在空间中清楚区分“已有想法”和“待回答问题”。

### 6.5 Claim

Claim 表示可以被证据支持或反驳的观点。

Claim 是旧方案中缺失但必要的对象。`supports` 和 `contradicts` 关系需要明确的观点目标，否则研究关系只剩下一般连线。

### 6.6 Frame

Frame 表示主题、方法、争议、研究阶段或用户自定义分区。

Frame 只负责画布内的空间分组，不修改 Zotero Collection、标签或条目结构。

### 6.7 Connection

首版只支持三种研究关系：

- `related`：一般相关；
- `supports`：来源或观点支持目标；
- `contradicts`：来源或观点反驳目标。

新连线默认为 `related`。用户选中连线后可以修改关系类型。关系标签默认弱化显示，悬停或选中时增强，减少大画布的视觉噪声。

## 7. 首版范围

### 7.1 包含

基础画布能力：

- 创建、打开和重命名画布；
- Pan、Zoom；
- Select、Multi-select；
- 节点移动和调整尺寸；
- 分组；
- 连接；
- 复制和删除；
- Undo、Redo；
- 自动保存和关闭前 flush；
- 保存并恢复视口、节点和连线。

Zotero 集成：

- 从 Zotero 条目列表拖入 Literature；
- 从 PDF 批注添加 Quote；
- 从 Literature Inspector 浏览批注；
- 从 Canvas 返回 Zotero 条目；
- 从 Canvas 打开 PDF 和原始批注；
- 监听 Zotero 元数据变化；
- 对删除或失效来源进行降级显示。

研究组织：

- Literature；
- Quote；
- Note；
- Question；
- Claim；
- Frame；
- 三种 Connection。

### 7.2 不包含

免费版首期不包含：

- 账号、授权和付费功能；
- Bamboo 云同步；
- 浏览器或移动端画布；
- 实时协作、评论和分享；
- AI 生成、聚类和远程分析；
- Outline View 和 Relationship View；
- 演示模式；
- 高级导出；
- 复杂自由绘图；
- 通用流程图工具；
- Markdown 标题级或段落级双向同步。

## 8. 入口与界面结构

### 8.1 打开方式

Research Canvas 默认作为 Zotero 主窗口中的独立标签页打开，与 Bamboo 现有 Markdown 标签页保持一致。

入口包括：

- Zotero 工具栏中的 Research Canvas 入口；
- `.canvas` 附件的双击打开；
- 文献右键菜单中的“添加到研究画布”；
- PDF 批注右键菜单中的“添加到当前画布”。

当没有活动画布时，“添加到研究画布”要求用户新建或选择一个已有画布。当存在活动画布时，默认加入当前画布，同时保留选择其他画布的入口。

### 8.2 页面布局

```text
┌─────────────────────────────────────────────────────┐
│ 画布名称   撤销 重做   添加   搜索       缩放  更多 │
├────────────┬──────────────────────────┬─────────────┤
│ Zotero 来源│                          │ Inspector   │
│            │                          │             │
│ 文献       │       无限画布           │ 当前卡片信息│
│ 批注       │                          │             │
│ 最近使用   │                          │ 操作与属性  │
│            │                          │             │
├────────────┴──────────────────────────┴─────────────┤
│ 已保存                                      100%   │
└─────────────────────────────────────────────────────┘
```

职责固定为：

- 顶部工具栏：创建对象、撤销、重做、搜索和视口操作；
- 左侧来源面板：查找 Zotero 文献和批注；
- 中央画布：空间组织与连接；
- 右侧 Inspector：显示完整来源信息、节点属性和相关操作；
- 底部状态：保存状态和缩放比例。

### 8.3 信息密度

卡片只显示辨认内容所需的信息。完整元数据、来源操作和不常用属性放入 Inspector，避免画布退化成密集的 Zotero 条目列表。

## 9. 核心交互

### 9.1 文献进入画布

```text
Zotero Item
  → 拖入 Canvas
  → 创建 Literature
  → 立即显示本地元数据
```

重复拖入同一文献时不静默创建副本。界面定位并短暂强调已有节点，同时允许用户显式选择“仍然创建副本”。

### 9.2 批注进入画布

用户可以：

- 在 Zotero PDF Reader 中把批注添加到当前画布；
- 从 Literature Inspector 的批注列表拖入或添加 Quote。

新 Quote 放在当前视口中心附近，或者放在其来源 Literature 附近，避免出现在不可见区域。

### 9.3 创建思考对象

Note、Question 和 Claim 可以从工具栏、右键菜单或键盘快捷键创建。创建后立即进入文本编辑状态。

### 9.4 建立关系

用户从节点连接点拖出连线。连线创建后使用 `related`，用户可以通过连线工具栏或 Inspector 改为 `supports` 或 `contradicts`。

### 9.5 返回来源

双击 Literature 默认打开 PDF；没有 PDF 时在 Zotero 中定位条目。双击 Quote 打开对应 PDF 并定位原始批注。所有自动跳转失败都要显示明确原因。

## 10. 文件与存储

### 10.1 文件定位

每个画布对应一个 `.canvas` 文件。

首版默认创建为 Zotero standalone stored attachment：

- 文件出现在 Zotero 资料库中；
- 跟随用户已有的 Zotero 文件同步配置；
- 文件不依赖 Bamboo 私有账号；
- 插件卸载后文件仍归用户所有。

Linked `.canvas` attachment 属于后续免费增强，不阻塞首版。

### 10.2 格式选择

文件使用 JSON Canvas 兼容结构，并通过 `bamboo` 字段保存 Zotero 引用和研究语义。

```json
{
  "version": 1,
  "nodes": [],
  "edges": [],
  "bamboo": {
    "title": "Literature Review",
    "createdAt": "2026-08-28T00:00:00.000Z",
    "updatedAt": "2026-08-28T00:00:00.000Z"
  }
}
```

位置、尺寸、标准文本、分组和边使用 JSON Canvas 字段。Bamboo 不直接持久化 React Flow 的内部对象。

### 10.3 互操作边界

其他 JSON Canvas 编辑器应当能够读取基本文本、分组和连线。Bamboo 专属语义保存在扩展字段中。

Bamboo 自身读取并重新保存文件时必须保留未知字段。第三方编辑器是否保留 Bamboo 扩展字段不受 Bamboo 控制，因此不承诺无损第三方往返编辑。

## 11. Zotero 引用与快照

### 11.1 Literature 引用

不同 Zotero 资料库可能存在相同 `itemKey`，所以引用至少包含：

```json
{
  "libraryID": 1,
  "itemKey": "ABCD1234"
}
```

### 11.2 Quote 引用

Quote 保存：

```json
{
  "libraryID": 1,
  "itemKey": "ABCD1234",
  "attachmentKey": "PDF12345",
  "annotationKey": "ANNO9876",
  "pageLabel": "6"
}
```

其中：

- `itemKey` 指向文献条目；
- `attachmentKey` 指向具体 PDF；
- `annotationKey` 指向原始批注；
- `pageLabel` 仅用于显示和降级，不作为唯一定位依据。

### 11.3 最小显示快照

Zotero 仍然是事实来源，但节点保存最小快照，以支持即时渲染和来源失效后的可读性。

Literature 快照包含：

- 标题；
- 简化作者；
- 年份；
- 出版物。

Quote 快照包含：

- 摘录文本；
- 批注注释；
- 页码；
- 颜色。

快照不用于覆盖 Zotero 数据。

## 12. 数据结构

Literature 节点示例：

```json
{
  "id": "node-literature-1",
  "type": "text",
  "x": 320,
  "y": 180,
  "width": 320,
  "height": 160,
  "text": "[The Role of X in Y](zotero://select/library/items/ABCD1234)",
  "bamboo": {
    "kind": "literature",
    "source": {
      "libraryID": 1,
      "itemKey": "ABCD1234"
    },
    "snapshot": {
      "title": "The Role of X in Y",
      "authors": ["Smith"],
      "year": 2024,
      "publicationTitle": "Nature"
    }
  }
}
```

Connection 示例：

```json
{
  "id": "edge-1",
  "fromNode": "quote-1",
  "toNode": "claim-1",
  "label": "supports",
  "bamboo": {
    "relation": "supports"
  }
}
```

数据权威边界如下：

| 数据                       | 权威来源 |
| -------------------------- | -------- |
| 文献标题、作者、年份、标签 | Zotero   |
| 批注正文、颜色、页码       | Zotero   |
| 节点位置、尺寸、视口、分组 | Canvas   |
| Note、Question、Claim      | Canvas   |
| 连线和研究关系             | Canvas   |

## 13. 更新与失效处理

Zotero Notifier 只刷新受影响来源，不重建整张画布。

规则为：

- 文献字段更新：刷新 Literature 显示和快照；
- PDF 更新：刷新附件可用状态；
- 批注更新：刷新 Quote 显示和快照；
- 文献删除：保留节点，显示“来源已丢失”；
- PDF 删除：保留 Literature，禁用“打开 PDF”；
- 批注删除：保留 Quote 快照，标记原始批注不可用；
- 来源暂时无法读取：显示已有快照，不删除任何用户内容。

更新来源信息时不得修改节点的位置、分组、用户文本或连线。

## 14. 技术架构

### 14.1 总体结构

```text
Zotero 主窗口
  ├─ Canvas 标签页和文件会话
  ├─ Zotero Bridge
  ├─ Canvas Save Coordinator
  └─ Zotero Notifier
          ║
       postMessage
          ║
Canvas iframe
  ├─ React
  ├─ @xyflow/react
  ├─ 节点与连线组件
  ├─ Canvas State
  └─ Undo / Redo
```

React 和 `@xyflow/react` 只用于新的 Canvas iframe，不要求重写现有 Bamboo 或 Markdown 编辑器 UI。

### 14.2 职责边界

Zotero 侧负责：

- 创建、读取和写入 `.canvas` 附件；
- 标签页与会话生命周期；
- 查询条目、附件和批注；
- 打开 Zotero 条目和 PDF；
- Notifier 监听；
- 持久化与退出前 flush。

Canvas iframe 负责：

- 节点和连线渲染；
- 选择、拖动、缩放和分组；
- Inspector 与画布内工具栏；
- Undo、Redo；
- 生成可序列化的文档快照。

iframe 不直接调用 Zotero API。双方只通过类型明确、JSON-friendly 的消息协议通信。

### 14.3 建议模块

```text
src/modules/canvas/
  ├─ api/          对外稳定接口
  ├─ bridge/       Zotero 条目、附件和批注适配
  ├─ model/        节点、连线和引用模型
  ├─ protocol/     iframe 通信协议
  ├─ storage/      读取、校验、迁移和保存
  ├─ session/      标签页与保存生命周期
  └─ ui/           Zotero 侧入口和外壳

src/canvas/
  ├─ nodes/        React 节点组件
  ├─ edges/        研究关系组件
  ├─ state/        操作、选择和 Undo/Redo
  ├─ panels/       Toolbar、Sidebar、Inspector
  └─ bootstrap.tsx Canvas iframe 入口
```

Canvas 与 Markdown 后续通过公开模块 API 联动，不互相读取内部状态。

## 15. 数据流

### 15.1 打开画布

```text
用户打开 .canvas
  → Zotero 侧读取并校验文件
  → 必要时执行版本迁移
  → 创建 Canvas Session
  → 把文档快照发送给 iframe
  → iframe 先渲染文件快照
  → Zotero Bridge 异步刷新来源元数据
```

来源查询不得阻塞首次显示。

### 15.2 编辑与保存

```text
用户操作
  → iframe revision 增加
  → 通知 Zotero 侧文档已变化
  → 自动保存进入单写入队列
  → Zotero 侧请求最新完整快照
  → 校验并序列化
  → 写入临时文件
  → 原子替换目标文件
  → 更新 savedRevision
```

如果写入期间发生新操作，当前写入完成后继续保存新的 revision。关闭标签页或 Zotero 前必须 flush 当前会话。

### 15.3 外部来源更新

```text
Zotero Notifier
  → 合并短时间内的相关事件
  → 找到引用受影响来源的节点
  → 查询最新元数据
  → 更新显示和快照
  → 触发正常保存
```

## 16. 保存与恢复

Canvas 使用与 Markdown 编辑器一致的 revision 思路，但拥有独立的 Canvas Save Coordinator。

要求如下：

- 同一 Canvas Session 只有一个文件写入者；
- 所有保存请求进入同一队列；
- 保存使用 iframe 的最新完整快照；
- 旧 revision 完成后不能错误标记新 revision 为已保存；
- 文件写入使用同目录临时文件和原子替换；
- 写入失败时原文件保持不变；
- 临时文件只在明确确认不是活动写入后清理；
- 文件解析失败时禁止自动保存覆盖；
- iframe 异常时保留 Zotero 侧最后收到的有效快照。

## 17. 错误处理

产品不使用静默失败。

### 17.1 文件错误

- 格式损坏：只读打开恢复界面，不覆盖原文件；
- 格式版本过新：拒绝编辑，但允许复制或导出原文件；
- 保存失败：持续显示未保存状态，保留内存内容并允许重试；
- flush 失败：阻止无提示关闭，向用户提供重试和保留恢复数据的选择。

### 17.2 Zotero 来源错误

- 条目不存在：显示快照和来源丢失状态；
- PDF 不存在：禁用打开 PDF，但保留卡片；
- 批注不存在：禁用定位，保留摘录；
- 元数据查询失败：显示旧快照并允许稍后刷新；
- 一个来源失败：不阻塞其他节点刷新。

### 17.3 交互错误

- 重复拖入来源：定位已有节点，不静默重复；
- 无活动画布：要求新建或选择画布；
- 不允许的连线状态：拒绝提交并保持编辑上下文；
- iframe 未就绪：Zotero 侧排队首批消息，握手完成后发送。

## 18. 格式版本与迁移

文件从第一版开始携带显式 `version`。

迁移规则：

- 只执行从旧版本到当前版本的单向迁移；
- 迁移先在内存中完成并通过校验；
- 用户产生第一次编辑或明确保存前，不覆盖原文件；
- 未知顶层字段、节点字段和边字段必须保留；
- 高于当前支持版本的文件以只读方式打开；
- 每一条迁移都需要独立测试样例。

## 19. 开发里程碑

### 19.1 里程碑一：Canvas Kernel

范围：

- Canvas iframe；
- React 与 `@xyflow/react`；
- `.canvas` 创建、打开和识别；
- Schema 校验、解析和序列化；
- Pan、Zoom、Select、Multi-select；
- 节点移动和调整尺寸；
- Undo、Redo；
- revision 自动保存和 flush；
- 一个测试文本节点和标准连线。

完成标准：创建画布、编辑、关闭 Zotero、重新打开后状态完全一致。

### 19.2 里程碑二：Zotero Research Bridge

范围：

- Literature 和 Quote；
- Zotero 文献拖入；
- PDF 批注添加；
- 打开条目、PDF 和原始批注；
- `libraryID + itemKey` 引用；
- 元数据快照和异步刷新；
- Notifier；
- 来源失效降级。

完成标准：文献和批注能够进入画布，并且可以可靠返回原始来源。

### 19.3 里程碑三：研究思考闭环

范围：

- Note、Question、Claim；
- Frame；
- 三种 Connection；
- 节点创建工具栏；
- Zotero 来源面板；
- Inspector；
- 分组、复制、删除和多选；
- 搜索与快速定位；
- 空画布引导和异常状态。

完成标准：用户可以围绕一个研究问题组织多篇文献、证据和观点。

里程碑一至三共同构成免费版 MVP。

### 19.4 里程碑四：免费体验增强

MVP 稳定后增加：

- Bamboo Markdown 文档卡片；
- 双击 Markdown 卡片打开现有编辑器；
- 从 Canvas 创建 Markdown 文档；
- 将 Claim、Question 或一组卡片整理为 Markdown；
- JSON Canvas 基础导入导出；
- Linked `.canvas` attachment；
- 图片和附件卡片；
- 模板；
- 更完整的键盘操作；
- 大画布导航、小地图和筛选；
- 深色模式与可访问性优化。

这一阶段的 Markdown 联动以文档为单位，不承诺标题级或段落级双向同步。

## 20. 测试策略

### 20.1 单元测试

- Schema 校验；
- JSON Canvas 解析和序列化；
- 格式版本迁移；
- 未知字段保留；
- Zotero 引用生成和解析；
- 节点、连线和分组操作；
- Undo、Redo；
- relation 类型约束；
- 缺失来源降级逻辑。

### 20.2 协议与保存测试

- iframe 握手和消息格式；
- revision 顺序；
- 连续编辑时的单写入队列；
- 保存期间再次编辑；
- 标签页关闭时 flush；
- Zotero 退出时 flush；
- 写入失败时保留原文件；
- 损坏文件不会被自动覆盖；
- iframe 重启后的快照恢复。

### 20.3 Zotero 集成测试

- 个人资料库；
- 群组资料库；
- 同一条目拥有多个 PDF；
- 文献元数据修改；
- 文献删除；
- PDF 删除；
- 批注修改和删除；
- stored attachment 的文件同步标记；
- Zotero 9；
- Zotero 10。

### 20.4 手工验收

每次公开发布前完整执行：

```text
创建画布
  → 拖入文献
  → 添加 PDF 批注
  → 创建 Claim
  → 建立 supports 和 contradicts
  → 分组并移动节点
  → 关闭并重新打开
  → 修改 Zotero 元数据
  → 删除一个来源
  → 检查快照和降级显示
```

## 21. 性能标准

- 文件快照先渲染，Zotero 元数据随后异步刷新；
- 来源查询不阻塞首次显示；
- 自动保存不阻塞拖动、缩放和文本输入；
- 短时间内的 Zotero 更新合并处理；
- 单个来源变化只更新引用它的节点；
- 使用约 200 个节点、300 条连线的画布作为首版性能验收场景；
- 性能场景中不得出现因同步元数据查询导致的持续界面冻结。

## 22. 后期方向

以下内容只作为远期路线占位，不属于当前 MVP：

- Outline View；
- Relationship View；
- 演示模式；
- 分享与协作；
- 跨设备 Web 访问；
- 远程分析。

远程分析的范围仅定义为：

> 用户主动选择文献或卡片后，远程服务可以提供主题聚类、观点对比和证据关系建议。生成结果必须先由用户确认，不直接修改画布。

当前方案不进一步设计远程数据边界、服务架构或商业模式。

## 23. 最终决策摘要

| 项目               | 决策                                                        |
| ------------------ | ----------------------------------------------------------- |
| 产品定位           | Zotero 空间化研究工作台                                     |
| 核心用户           | 个人研究者                                                  |
| 首版模式           | 免费、local-first、无需账号                                 |
| 核心流程           | 文献 → 批注 → 观点/问题 → 研究关系                          |
| 核心对象           | Literature、Quote、Note、Question、Claim、Frame、Connection |
| 画布引擎           | React + `@xyflow/react`，运行在独立 iframe                  |
| 持久化             | JSON Canvas 兼容 `.canvas` 文件                             |
| 默认存储           | Zotero standalone stored attachment                         |
| Zotero 引用        | `libraryID + itemKey`，批注增加 attachment/annotation Key   |
| 文献事实来源       | Zotero                                                      |
| 用户思考与布局来源 | Canvas 文件                                                 |
| Markdown 联动      | MVP 后的免费增强，先做到文档级                              |
| AI 与远程分析      | 非核心、后期占位                                            |
| 商业化             | 不在本设计范围内                                            |

## 24. 一句话定义

> Bamboo Research Canvas：在 Zotero 中把文献、摘录、观点和问题放进同一个空间，建立可以回到原始证据的研究结构。
