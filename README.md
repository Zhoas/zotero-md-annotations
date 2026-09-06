# Zotero Markdown Annotations

Make annotations in Zotero 7/9 work as Markdown rather than pure text.
让 Zotero 中的批注以 Markdown 格式渲染，而非纯文本显示。

## ⚠️ Maintenance Notice / 维护须知

> **Note**: This project was collaboratively developed by the repository owner and **Google DeepMind's Gemini** (via Antigravity). This project **may not be actively maintained** in the future. It is open-sourced under the **GPL-3.0 License** so that other open-source enthusiasts can freely modify, fork, and use it.
> 
> **注意**：本项目由仓库所有者与 **Google DeepMind 的 Gemini** (通过 Antigravity 架构) 结对编程开发完成。本项目**未来可能不会主动维护**。基于 **GPL-3.0 协议** 开源，欢迎其他热爱开源的朋友自由分叉（Fork）、修改和使用。

## Features / 功能特性

- **Markdown Rendering**: Natively renders markdown (headers, lists, bold, italics, etc.) inside Zotero PDF annotation comments.
- **KaTeX Math Support**: Renders LaTeX math equations `$$ ... $$` natively within Zotero, bypassing strict CSP limitations with an in-memory font loader.
- **Seamless Resize Sync**: Smart `ResizeObserver` breaks Zotero's rigid CSS locks, allowing smooth resizing of the preview box that expands the native Zotero popup.
- **Zero Memory Leaks**: Designed with performance in mind. Uses `querySelectorAll` for microsecond DOM scanning (bypassing slow `TreeWalker` loops) and cleans up all memory/CSS injections on disable.

- **原生 Markdown 渲染**：在 Zotero PDF 批注中直接渲染 Markdown（标题、列表、加粗、斜体等）。
- **KaTeX 数学公式支持**：支持 `$$ ... $$` 的 LaTeX 渲染，独创内存字体加载机制，完美绕过 Zotero 严格的 CSP 安全限制。
- **自适应缩放同步**：内置智能的 `ResizeObserver` 雷达，打破 Zotero 官方底层的 CSS 尺寸死锁，让预览框可以像原生源码框一样自由缩放并撑开外框。
- **零内存泄漏**：采用极速 `querySelectorAll` 替代笨重的 `TreeWalker` DOM 轮询，且在禁用插件时实现彻底的无痕卸载。

## Installation / 安装使用

1. Go to the [Releases](https://github.com/Zhoas/zotero-md-annotations/releases) page and download the latest `.xpi` file.
   前往 [Releases](https://github.com/Zhoas/zotero-md-annotations/releases) 页面下载最新的 `.xpi` 文件。
2. Open Zotero, go to `Tools -> Add-ons`.
   打开 Zotero，进入 `工具 -> 附加组件`。
3. Click the gear icon and select `Install Add-on From File...`, then choose the downloaded `.xpi`.
   点击右上角齿轮图标，选择 `从文件安装附加组件...`，选择下载的 `.xpi` 文件即可。
4. Open any PDF, add a text comment, and you will see a `MD Preview` / `源码编辑` toggle button at the bottom of the box.
   打开任意 PDF，添加文本批注，你会发现批注框底部多出了一个 `MD预览` / `源码编辑` 的切换按钮。

## Changelog / 更新日志

### v0.1.3 (2026-09-06)
- **修复 PDF 内批注弹窗（Popup）缩放与切换问题**：
  - 修复外部白色卡片容器不跟随内容缩放的 Bug：精确定位绝对定位的弹出层外壳容器，完全还原 0.1.2 的平滑拖拽缩放机制，使外部白色卡片（包括头部与底部）与内容同步扩展包裹。
  - 修复连续点击不同批注时的渲染与尺寸问题：引入微任务级即时重绘，解决上一个批注内容画面残留（闪烁）以及尺寸被前一个批注拉伸撑满全屏的问题。
- **修复主界面右侧边栏批注无法渲染的问题**：
  - 彻底解决 Zotero 7 主窗口 XHTML (`application/xhtml+xml`) 环境下由于 `<hr>`（分割线 `---`）、`<br>` 引起的 `NS_ERROR_DOM_SYNTAX_ERR` 严格 XML 解析报错。
  - 引入 `setSafeHTML` 安全节点导入机制与 `xhtmlOut` 规范，实现右侧条目面板与 PDF 阅读器内部完全一致的 Markdown 和 KaTeX 公式渲染体验。
  - 增强 `annotation-id` 整型识别与数据读取容错。
- **完善边栏卡片与样式体验**：
  - 保留 PDF 左侧边栏卡片的折叠展开机制与垂直缩放调节。
  - 新增 Markdown 表格的优雅边框、斑马纹与居中排版。
  - 优化公式水平滚动，杜绝超长公式溢出或截断。

### v0.1.2 (2026-09-05)
- 优化缩放手柄与动态双向尺寸同步（`ResizeObserver`），消除窗口跳变。
- 批注卡片打开时自动渲染已有内容（非空批注默认进入 MD 预览模式）。
- 限制批注最大高度，防止长文本无限纵向拉伸并提供滚动条。

## Build from Source / 从源码构建

Requirements: Python 3
环境要求: Python 3

```bash
git clone https://github.com/Zhoas/zotero-md-annotations.git
cd zotero-md-annotations
python build.py
```

## License / 开源协议
[GPL-3.0 License](./LICENSE)