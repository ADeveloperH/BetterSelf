# 0.5.2：Unity 性能配置操作说明

日期：2026-10-26。本版把 Unity 性能文章中的配置结论补全为可在 Editor 中复现的操作记录。

## 改动

- Android 固定 30 FPS 案例补充 `Optimized Frame Pacing` 的 Editor 路径、`androidUseSwappy` 字段、配置边界、A/B 包方法、副作用、验证矩阵和回退步骤。
- 移动端性能总览先确认 Android 实际使用的 Quality 与 URP Asset，再分别说明实时阴影、SSAO、Camera 后处理、HDR、Intermediate Texture、Render Scale 和 MSAA。
- 每项配置都记录作用、本次取值、潜在问题、生效验证和回退方式；组合优化继续注明无法独立归因。
- 内容规范和私有实践模板新增“配置改动记录”，后续整理同类问题沿用同一结构。

## 验证

- 待发布后补充自动测试、GitHub Pages 任务和手机视口检查结果。
