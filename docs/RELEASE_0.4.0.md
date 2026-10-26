# 0.4.0：Unity 构建与依赖管理

日期：2026-10-26。本版处理第四批 10 个有道云来源，新增 5 篇整理稿。网站内容由 13 篇增加到 18 篇；5 道面试题及计划、案例、导航和学习记录模型不变。

## 新增内容

- 在 macOS 上用 Jenkins 构建 Unity：构建机边界、命令行入口、Pipeline、凭据隔离与制品追踪。
- Unity Android 的 R8 混淆字典缺失排查：从最终 Gradle 模块定位规则和文件，说明绝对路径方案的限制。
- Unity Play Asset Delivery 配置与模板升级：AAB、Split Application Binary、交付模式和 `PLAY_ASSET_PACKS`。
- Unity 外部依赖管理：从 EDM4U 到官方 EDM，并整理 `Dependencies.xml` 与私有仓库凭据边界。
- Unity Android 原生崩溃符号与发布归档：区分 R8 mapping 与 native symbols，覆盖 Google Play 与 Firebase 上传。

来源 6 的 Android Player Settings 记录只作为本地检查清单输入。Gamma、Linear、HDR 与 HTTP 策略需要结合渲染管线、资源导入、设备和安全要求验证，因此未把单个项目现象发布为通用建议。

## 原文与隐私

- 10 个来源均通过只读 MCP 取得纯文本，没有图片或附件块。
- R8、PAD、EDM 和 Native 笔记提供公开原文对照，删除本机用户名、项目名、绝对路径和内部仓库配置。
- Jenkins 安装、构建脚本和上传来源含真实 API Key、Webhook、内部目录与流程，不提供公开原文入口；整理稿只保留通用结构。
- 原始响应、来源 ID、路径、哈希和逐篇决定继续保存在 Git 忽略的统一批次目录。

## 技术复核

- Unity 6 文档确认 PAD 使用 AAB、Split Application Binary 与 `PLAY_ASSET_PACKS`，旧自定义 Gradle 模板应从当前 Editor 重新生成。
- Unity 官方 EDM 支持 Unity 2022.3+，兼容 EDM4U 的 XML 依赖声明；Unity 6 当前包列表为 2.1.1。
- Unity 6 可生成 zip 或把符号嵌入 AAB；Firebase 要求 Android IL2CPP 构建上传符号，才能显示 native library 的符号化堆栈。
- Jenkins 上传示例改用 Credentials Binding，并限制 secret 的作用域与 shell 回显。

## 验证

- 内容校验通过：18 篇文章、5 道题、16 篇公开原文对照。
- 48 项自动测试全部通过。
- TypeScript 检查与正式 `/BetterSelf/` 构建通过，生成 PWA 清单、服务工作线程和离线预缓存。
- [GitHub Actions 发布任务](https://github.com/ADeveloperH/BetterSelf/actions/runs/40296026718)成功完成测试、构建、上传和 Pages 部署。
- 线上点击“保存进度并更新”后显示 0.4.0 和 18 篇笔记；已有 Addressables 阅读进度 100% 与训练角标 1 保留。
- 390×844 视口下，R8 整理稿以独立详情页显示，没有底部 Tab；可以进入脱敏原文，并通过“返回整理稿”回到详情。

原始笔记中曾硬编码真实上传凭据。公开内容没有带出这些值；账号所有者仍应轮换相关凭据并检查访问记录。
