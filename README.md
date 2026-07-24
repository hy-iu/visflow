# VisFlow ── 极简、灵活且放映逻辑完整的现代化看图软件

> **GitHub**: [https://github.com/hy-iu/visflow](https://github.com/hy-iu/visflow)

VisFlow 是一款基于 Electron + React + TypeScript 构建的高颜值、高性能看图与照片整理工具。它打破了传统看图软件“单线程（要么纯按图集，要么全部打平图片混作一堆）”的死板逻辑，提供更加自由、多维度的组织管理和全屏幻灯片放映体验。

---

## 核心特性

- **多维度组织架构**
  - **📁 文件夹/图集 (Collections)**：支持建立多级目录树嵌套，与真实的物理文件夹映射或按主题归纳。
  - **🏷️ 标签 (Tags)**：支持跨图集打标，赋予每张照片独一无二的元数据属性。
  - **🎬 播放列表 (Playlists)**：支持自由添加图片以编排放映列表。每个播放列表均可配置专属的播放时间、转场特效、转场时长、循环或随机模式。
  - **🔍 智能分组 (Smart Groups)**：支持配置一系列动态规则（例如：评分大于 4 星 且 格式为 PNG 的所有图片），自动筛选出匹配的图片。

- **多种播放模式**
  - 点击播放列表的设置按钮进入放映，支持 10 种转场/展示效果：
  - **单张轮播类**（逐张切换，可配置停留时间 2~10 秒）：
    - 渐变 (Fade)、浮入/浮出 (Slide)、水平滑动、竖直滑动、跳变、缩放 (Zoom)、电影 (Ken Burns)
  - **连续滚动类**（所有图片同屏展示，自动匀速滚动）：
    - 竖直瀑布流滚动、水平瀑布流滚动、有机嵌合滚动 (Organic Collage)
  - 支持循环播放、随机播放、缩放比例调节 (0.5x~2.0x)、适应屏幕/原始大小切换

- **NSFW 内容审查**
  - 双模型检测：nsfwjs (InceptionV3) + NudeNet v3 (YOLO)，双模型交叉验证提高准确率。
  - 审查结果三态：已审查 (safe) / NSFW / 未审查 (pending)。
  - 筛选视图：默认隐藏 NSFW 图片，可切换为“仅 NSFW”或“全部”视图。
  - 批量扫描：一键扫描未审查图片，支持实时进度显示和取消。
  - 手动标记：右键菜单支持批量标记/取消 NSFW。

- **高性能虚拟滚动**
  - 网格布局：基于 `@tanstack/react-virtual` 的行级虚拟化，万张图片仅渲染可见区域。
  - 瀑布流布局：最短列优先算法 + 视口裁剪 + rAF 节流，保留图片真实宽高比。
  - 时间轴布局：支持网格/瀑布流双模式虚拟化。
  - 文件夹视图：渲染数量限制 + React.memo，避免大量 DOM 节点。

- **高颜值现代设计**
  - 玻璃拟态 (Glassmorphism) 视觉效果，丝滑的高阶暗黑/明亮主题切换。
  - 响应式侧边栏和信息详情面板。
  - 精美的缩略图微观加载骨架屏（Shimmer Placeholders）。

- **三大视图布局**
  - **网格布局 (Grid)**：传统的对齐网格，适合快速浏览。
  - **瀑布流布局 (Masonry)**：保留图片原始纵横比，最舒适的原图排列。
  - **时间轴布局 (Timeline)**：按照图片的创建时间/导入时间进行分段归纳。

- **强大的快捷操作与交互**
  - 右键任意图片（支持多选批量操作），可快捷分配至图集、标签、播放列表或移出库。
  - 精简而直观的键盘控制（见下文）。

---

## 图片多选操作

| 操作 | 效果 |
|------|------|
| 悬停图片 → 点击左上角复选框 | 切换该图片的选中状态（不影响其他已选图片） |
| Shift + 点击图片 | 将图片加入/移出多选集合（不打开查看器） |
| 直接点击图片 | 打开全屏查看器 |
| 右键已选图片 | 对所有选中图片执行批量操作 |

---

## 快捷键指南

### 大图查看与全局
* **`G`**：快速切换到网格布局。
* **`F`**：开启 / 关闭系统全屏模式。
* **`I`**：在大图查看器中展开/收起图片信息详情面板 (Exif/色彩/物理信息)。
* **`Ctrl+K`**：打开命令面板（快速搜索并执行操作）。
* **`Esc`**：关闭大图查看器 / 关闭幻灯片播放。

### 播放列表放映 (Player)
* **`Space (空格)`**：播放 / 暂停幻灯片。
* **`→ (右方向键)`**：下一张图片。
* **`← (左方向键)`**：上一张图片。

---

## 技术栈与架构设计

### 1. 前端 (Renderer)
- **React** (v18) & **TypeScript**
- **Zustand** (超轻量状态管理，驱动全局的 `useViewStore` 与 `useLibraryStore`)
- **@tanstack/react-virtual** (高性能虚拟滚动)
- **Vanilla CSS & CSS Variables** (高度可定制的主题变量设计)

### 2. 主进程 (Main Process)
- **Electron** (v30+)
- **Drizzle ORM** + **SQLite (Better-SQLite3)**：构建健壮的本地关系型数据库，实现高效的属性检索与智能规则过滤。
- **Sharp**：后台线程极速生成缩略图并缓存，防止大图渲染卡顿。
- **onnxruntime-node** + **NudeNet v3 (YOLO)**：本地 NSFW 图片检测推理引擎。
- **nsfwjs** (TensorFlow.js WASM)：第二层 NSFW 检测模型，双模型交叉验证。

### 3. 自定义安全协议 (Custom Security Protocols)
- **`thumb://<imageId>`**：读取并在渲染进程安全载入对应图片的生成缩略图（缓存在本地应用数据目录）。
- **`local-image://_/?path=<encoded-path>`**：解决 Electron 现代版本中因为浏览器同源安全限制（CSP）而无法直接加载本地磁盘绝对路径（如 `C:\...`）的问题。通过查询参数将路径无损穿透至主进程读取，安全又高效。

---

## 启动与构建步骤

请确保本地已安装 Node.js 环境 (v18+)。

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发调试服务
```bash
npm run dev
```
此命令将开启 Vite 渲染端的热更新服务器，并自动启动 Electron 主进程，且在启动时会自动展开 **Chrome DevTools** 辅助开发。

### 3. 类型检查
```bash
npm run typecheck
```

### 4. 构建打包
```bash
npm run build
```

---

## 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── db/            # 数据库连接与 Schema (Drizzle ORM)
│   ├── ipc/           # IPC 通信处理 (images, tags, collections, nsfw...)
│   ├── services/      # 业务服务 (exif, importer, nsfw, thumbnail)
│   ├── index.ts       # 主进程入口
│   └── protocol.ts    # 自定义协议注册 (thumb://, local-image://)
├── preload/           # 预加载脚本 (API 桥接)
└── renderer/          # React 渲染进程
    ├── components/    # UI 组件
    │   ├── gallery/   # 图库视图 (Grid, Masonry, Timeline, Folder)
    │   ├── layout/    # 布局组件 (Sidebar, Toolbar, StatusBar)
    │   ├── viewer/    # 图片查看器
    │   ├── player/    # 幻灯片播放器
    │   ├── organize/  # 组织管理 (CollectionTree, TagManager...)
    │   └── common/    # 通用组件 (Modal, ContextMenu, CommandPalette)
    ├── hooks/         # 自定义 Hooks
    ├── stores/        # Zustand 状态管理
    ├── lib/           # 工具函数
    └── styles/        # 全局样式
```

---

## License

[MIT](https://opensource.org/licenses/MIT)
