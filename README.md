# BetterSelf

面向个人成长的 Unity 知识与面试复习 PWA。电脑用于整理内容，Android 手机用于阅读、检索和练习。

网站已发布：一篇 C# 笔记、5 道面试题，以及阅读、自评、搜索、收藏和备份。PWA 缓存与版本更新已在桌面浏览器验证，Android 实机验收待完成。

- [实施计划](docs/IMPLEMENTATION_PLAN.md)：首版范围、技术方案、开发顺序和验收标准。
- [内容规范](docs/CONTENT_GUIDE.md)：知识文章、面试题的模板和第一批示例范围。
- [验证记录](docs/VERIFICATION.md)：已完成的检查与实机待验收项目。
- [Android 测试步骤](docs/ANDROID_TESTING.md)：手机阅读、安装与离线检查。

源码仓库：[ADeveloperH/BetterSelf](https://github.com/ADeveloperH/BetterSelf)。

网站地址：[BetterSelf](https://adeveloperh.github.io/BetterSelf/)。首次自动测试、构建和发布均已成功，后续发布进度可在仓库的 Actions 页面查看。

已确认的要求：

- 暂用名称 BetterSelf。
- 主要方向为 Unity，包含与 Android 结合的客户端开发。
- 优先保证 Android 手机体验；用户提供的手机型号为“红米k100pro”，使用手机自带浏览器，具体浏览器与系统版本待实机确认。
- 网站运行和发布采用免费方案，使用平台提供的网址；是否公开没有特别要求。
- 第一批示例为“C# 与 Unity 面试基础”。
- 先跑通完整使用流程，再批量整理历史经验和知识。

第一个交付目标：在手机上打开一篇示例文章，练习 5 道题，保存掌握程度，并验证安装、缓存和内容更新。

## 在电脑上运行

使用 Node.js 22.12+ 的 22.x 版本，或 Node.js 24+。

```sh
npm ci
npm run dev
```

打开终端中显示的本地地址。这个地址用于当前电脑；手机测试需要后续的 HTTPS 发布地址。

检查与正式构建：

```sh
npm test
npm run build
npm run preview
```

正式构建的预览包含离线缓存与更新流程。开发预览关闭服务工作线程，以便及时查看修改。

## 修改内容

- 知识文章：`content/articles/*.md`。
- 面试题：`content/questions/*.yaml`。
- 结构与字段说明：[内容规范](docs/CONTENT_GUIDE.md)。

修改内容后执行 `npm run content`，已开启的开发服务会接收生成内容的变化。正式构建会自动执行内容校验。`src/generated/` 是生成目录，修改来源文件即可。

## 学习记录

掌握程度、收藏和阅读位置保存在当前浏览器的 IndexedDB 中。内容通过稳定 ID 关联，文章改名或更新答案时继续保留原 ID。

“我的复习”页面可以导出 JSON 备份；导入时先预览，再按修改时间合并较新的记录。更换设备、浏览器或站点域名时使用备份迁移。

当前示例内容与应用整体缓存，界面显示“离线已就绪”后可离线阅读和练习。内容增长后再增加按专题下载。

## 发布准备

免费静态托管可以使用构建产物 `dist/`。项目支持根路径和子路径，例如：

```sh
VITE_BASE_PATH=/BetterSelf/ npm run build
VITE_BASE_PATH=/BetterSelf/ npm run preview
```

用户已确认使用公开仓库与 GitHub Pages 免费发布。仓库为 `ADeveloperH/BetterSelf`。

GitHub Pages 自动发布配置位于 `.github/workflows/pages.yml`：应用代码或内容上传到 `main` 分支后先执行测试与构建，通过后才发布。单独修改项目说明或 `docs/` 文档不会重新部署网站。目标仓库已启用 GitHub Actions 发布方式。
