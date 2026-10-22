---
id: "vscode-emmet-html"
title: "VS Code：HTML 展开与快捷键速记"
topic: "编辑器与工程工具"
domainId: "engineering"
categoryId: "editors"
noteType: "guide"
tags: ["VS Code", "Emmet", "HTML", "快捷键"]
summary: "保留原快捷键截图与转录，补充 Emmet 展开条件和 Windows、Linux、macOS 默认键位差异。"
updatedAt: "2025-12-01"
verifiedAt: null
sample: false
applicability: "官方键位表与 Emmet 文档复核；Linux复制行按 VS Code 1.105.1 源码核对，未在用户编辑器实测。"
sources: [{"kind": "personal", "title": "有道云笔记历史记录"}, {"kind": "external", "title": "VS Code：Emmet", "url": "https://code.visualstudio.com/docs/languages/emmet"}, {"kind": "external", "title": "VS Code：Windows键位", "url": "https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf"}, {"kind": "external", "title": "VS Code：Linux键位", "url": "https://code.visualstudio.com/shortcuts/keyboard-shortcuts-linux.pdf"}, {"kind": "external", "title": "VS Code：macOS键位", "url": "https://code.visualstudio.com/shortcuts/keyboard-shortcuts-macos.pdf"}, {"kind": "external", "title": "VS Code 1.105.1：行操作源码", "url": "https://raw.githubusercontent.com/microsoft/vscode/1.105.1/src/vs/editor/contrib/linesOperations/browser/linesOperations.ts"}, {"kind": "external", "title": "VS Code：键位配置", "url": "https://code.visualstudio.com/docs/configure/keybindings"}]
---

> 2026-10-22 按 VS Code 官方文档、平台键位表与指定版本源码复核；未在用户编辑器中实测或修改设置。自定义键位、扩展和桌面环境可能改变结果。

## HTML 结构展开

原记录：`!+回车`。这通常依赖 HTML 语言模式、Emmet 建议是否出现及补全确认设置，不能保证在任意文件中按回车都展开。

更稳定的入口：将文件语言模式设为 HTML，输入 `!`，在命令面板执行 `Emmet: Expand Abbreviation`。如果希望用 Tab 展开，可在设置中启用 `emmet.triggerExpansionOnTab`；这是可选设置，本次没有替你更改。参见 [Emmet 官方说明](https://code.visualstudio.com/docs/languages/emmet)。

## 原截图转录

原表保留，便于与截图核对；它不是所有平台的统一键位。

| 操作 | 原截图键位 |
| --- | --- |
| 代码格式化 | `Shift+Alt+F` |
| 向上或向下移动一行 | `Alt+Up` 或 `Alt+Down` |
| 快速复制一行代码 | `Shift+Alt+Up` 或 `Shift+Alt+Down` |
| 快速保存 | `Ctrl+S` |
| 快速查找 | `Ctrl+F` |
| 快速替换 | `Ctrl+H` |


## 按平台查默认键位

| 操作 | Windows | Linux | macOS |
| --- | --- | --- | --- |
| Format Document | `Shift+Alt+F` | `Ctrl+Shift+I` | `Shift+Option+F` |
| 向上 / 下移动行 | `Alt+Up/Down` | `Alt+Up/Down` | `Option+Up/Down` |
| 向上 / 下复制行 | `Shift+Alt+Up/Down` | `Ctrl+Shift+Alt+Up/Down`（见版本说明） | `Shift+Option+Up/Down` |
| 保存 | `Ctrl+S` | `Ctrl+S` | `Cmd+S` |
| 查找 | `Ctrl+F` | `Ctrl+F` | `Cmd+F` |
| 替换 | `Ctrl+H` | `Ctrl+H` | `Option+Cmd+F` |

依据为官方 [Windows](https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf)、[Linux](https://code.visualstudio.com/shortcuts/keyboard-shortcuts-linux.pdf)、[macOS](https://code.visualstudio.com/shortcuts/keyboard-shortcuts-macos.pdf) 快捷键 PDF。Linux 复制行这一项另按 [VS Code 1.105.1 linesOperations 源码](https://raw.githubusercontent.com/microsoft/vscode/1.105.1/src/vs/editor/contrib/linesOperations/browser/linesOperations.ts) 的 Linux override 核对；未宣称已在当前 Linux 桌面实测。

键位不生效时，在 Keyboard Shortcuts 中按命令名搜索，查看当前绑定、冲突和 when 条件；按用户安装版本为准。见 [键位配置说明](https://code.visualstudio.com/docs/configure/keybindings)。

## 原始截图

![原笔记中的 VS Code 常用快捷键截图](assets/vscode-emmet-html/bd633784994b2222.png)

## 相关操作

[JSON 格式化与文件查找](#/article/vscode-format-and-open)补充命令面板、JSON formatter 与 Quick Open 的平台差异。
