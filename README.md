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