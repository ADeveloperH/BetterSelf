# 0.5.2：Unity 性能配置操作说明

日期：2026-10-26。本版把 Unity 性能文章中的配置结论补全为可在 Editor 中复现的操作记录。

## 改动

- Android 固定 30 FPS 案例补充 `Optimized Frame Pacing` 的 Editor 路径、`androidUseSwappy` 字段、配置边界、A/B 包方法、副作用、验证矩阵和回退步骤。
- 移动端性能总览先确认 Android 实际使用的 Quality 与 URP Asset，再分别说明实时阴影、SSAO、Camera 后处理、HDR、Intermediate Texture、Render Scale 和 MSAA。
- 每项配置都记录作用、本次取值、潜在问题、生效验证和回退方式；组合优化继续注明无法独立归因。
- 内容规范和私有实践模板新增“配置改动记录”，后续整理同类问题沿用同一结构。

## 验证

- 内容校验通过：21 篇文章、5 道题；Vitest 6 个测试文件、50 项测试全部通过。
- `/BetterSelf/` 子路径正式构建、PWA Service Worker 和离线预缓存生成成功。
- [GitHub Pages 发布任务](https://github.com/ADeveloperH/BetterSelf/actions/runs/40326294607) 的测试、构建、上传和发布全部成功。
- 正式站点更新到 `BETTERSELF / 0.5.2` 后，帧同步文章显示完整 Editor 操作和新增官方 API 来源，两篇性能文章互链正常。
- 390×844 视口下，性能总览 7 个配置小节正常换行；宽表格容器宽 306 px、内容宽 1805 px，可独立横向滑动。
