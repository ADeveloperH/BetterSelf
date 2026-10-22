---
id: "vscode-format-and-open"
title: "VS Code：JSON 格式化与文件查找"
topic: "编辑器与工程工具"
domainId: "engineering"
categoryId: "editors"
noteType: "guide"
tags: ["VS Code", "JSON", "快捷键"]
summary: "按命令名整理 JSON 内置格式化与 Quick Open，补充三平台快捷键和 formatter 排查入口。"
updatedAt: "2025-01-22"
verifiedAt: null
sample: false
applicability: "官方 JSON 文档与三平台默认键位表复核；自定义绑定、formatter 配置及安装版本待用户环境实测。"
sources: [{"kind": "personal", "title": "有道云笔记历史记录"}, {"kind": "external", "title": "VS Code：JSON", "url": "https://code.visualstudio.com/docs/languages/json"}, {"kind": "external", "title": "VS Code：Windows键位", "url": "https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf"}, {"kind": "external", "title": "VS Code：Linux键位", "url": "https://code.visualstudio.com/shortcuts/keyboard-shortcuts-linux.pdf"}, {"kind": "external", "title": "VS Code：macOS键位", "url": "https://code.visualstudio.com/shortcuts/keyboard-shortcuts-macos.pdf"}, {"kind": "external", "title": "VS Code：键位配置", "url": "https://code.visualstudio.com/docs/configure/keybindings"}]
---

> 2026-10-22 按 VS Code 官方文档与键位表复核；原笔记的 Windows 风格键位仍保留，其他平台见下表。没有在用户编辑器内实测或修改设置。

## 格式化 JSON

1. 确认当前文件的语言模式是 JSON 或 JSON with Comments，检查是否有语法错误。
2. 打开命令面板，搜索并执行 `Format Document`；也可使用编辑器右键菜单中的对应命令。
3. VS Code 内置 JSON 格式化支持；无需为这一步一律安装扩展。若无法格式化，检查 `json.format.enable`、当前模式、语法诊断和 formatter 配置；有多个 provider 时，通过 `Format Document With...` 选择。

原步骤中的 `Ctrl+Shift+P`、`Shift+Alt+F` 是 Windows 风格入口，Linux 格式化默认键不同。功能依据：[JSON 官方文档](https://code.visualstudio.com/docs/languages/json)。

## 命令面板与文件查找

| 任务 / 命令 | Windows | Linux | macOS |
| --- | --- | --- | --- |
| Command Palette | `Ctrl+Shift+P` | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Format Document | `Shift+Alt+F` | `Ctrl+Shift+I` | `Shift+Option+F` |
| Quick Open | `Ctrl+P` | `Ctrl+P` | `Cmd+P` |

Quick Open 用来查找并打开文件；在弹出框输入文件名或路径片段。原记录的 `Ctrl+P` 不是正文搜索键；正文查找通常用 Ctrl+F（macOS 为 Cmd+F）。

依据：[Windows键位表](https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf)、[Linux键位表](https://code.visualstudio.com/shortcuts/keyboard-shortcuts-linux.pdf)、[macOS键位表](https://code.visualstudio.com/shortcuts/keyboard-shortcuts-macos.pdf)。如果当前环境绑定不同，在 Keyboard Shortcuts 中按命令名核对，见 [键位配置说明](https://code.visualstudio.com/docs/configure/keybindings)。

## 相关速记

[HTML 展开与快捷键速记](#/article/vscode-emmet-html)包含 Emmet 条件说明、移动 / 复制 / 保存 / 查找 / 替换的平台对照，以及原始截图。两篇互补保留。
