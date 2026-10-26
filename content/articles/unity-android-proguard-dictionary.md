---
id: 'unity-android-proguard-dictionary'
title: 'Unity Android 的 R8 混淆字典缺失排查'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'build'
noteType: 'troubleshooting'
tags: ['Unity', 'Android', 'R8', 'ProGuard', 'Gradle']
summary: '从 R8 的 NoSuchFileException 反推规则来源、模块和路径解析位置，并比较可移植配置与本机绝对路径方案。'
updatedAt: '2026-10-26'
verifiedAt: null
sample: false
applicability: '适用于 Unity 导出的 Android Gradle 工程中，R8 在 release 混淆阶段找不到 obfuscation dictionary 的情况。原问题来自一个 IL2CPP 项目，本轮未取得该工程复现。'
sources:
  - kind: personal
    title: '有道云笔记：Android 代码混淆字典配置'
  - kind: external
    title: 'Unity 6：Android Gradle 工程结构'
    url: 'https://docs.unity3d.com/cn/6000.0/Manual/android-gradle-project-structure.html'
  - kind: external
    title: 'Android Developers：启用 R8 应用优化'
    url: 'https://developer.android.com/topic/performance/app-optimization/enable-app-optimization'
---

> 原问题的直接表现是 `minifyReleaseWithR8` 抛出 `NoSuchFileException`。历史方案为每台机器生成包含绝对路径的本地规则文件。它可以绕开部分路径解析问题，但会增加 CI、导出工程和多人协作的不确定性，因此应先定位是哪份规则在引用字典。

## 三种文件不要混在一起

| 文件                | 作用                      | 丢失后的影响                               |
| ------------------- | ------------------------- | ------------------------------------------ |
| `proguard-user.txt` | 项目的 R8 / ProGuard 规则 | 构建配置缺失或运行时类被错误裁剪           |
| `proguard-dict.txt` | 可选的名称字典            | 只有显式引用它时才需要                     |
| `mapping.txt`       | 本次构建生成的混淆映射    | 构建通常仍能完成，但线上 Java 堆栈无法还原 |

Unity 6 的文档说明，启用 Custom Proguard File 后，项目规则来自 `Assets/Plugins/Android/proguard-user.txt`，导出后进入 Gradle 工程。字典不是 Unity 自动约定的固定输入；只有规则中出现下面指令时，R8 才会读取它：

```text
-obfuscationdictionary proguard-dict.txt
-classobfuscationdictionary proguard-dict.txt
-packageobfuscationdictionary proguard-dict.txt
```

三条指令必须各占一行。把它们粘成一行会产生另一个解析问题。

## 先从异常路径判断模块

不要先把字典复制到多个目录。保留完整堆栈，回答四个问题：

1. 失败任务属于 `launcher`、`unityLibrary`，还是第三方 Android Library 模块？
2. 异常中的规则来自项目 `proguard-user.txt`，还是某个 AAR 的 consumer rules？
3. 字典路径相对于哪份规则文件解析？
4. 文件是否存在于 Unity 项目，但没有进入最终 Gradle 模块？

可以先导出 Gradle 工程，再搜索三条 dictionary 指令及字典文件：

```sh
rg -n "(class|package)?obfuscationdictionary" <exported-project>
find <exported-project> -name 'proguard-dict.txt' -print
```

如果错误路径落在 `unityLibrary/build/intermediates/consumer_proguard_dir/...`，重点检查库 consumer rules 的复制与合并，而不是只改 `launcher`。Unity 的 Gradle 工程包含多个模块，同名相对路径在不同模块中不是同一个位置。

## 优先使用可移植输入

理想状态是让字典和引用它的规则以同一插件或模块的资源一起交付，并在导出工程后检查实际位置。团队仓库、CI 和本机都使用同一份相对配置，不需要在每台机器生成不同文本。

如果 Unity 模板或第三方插件改变了 consumer rules 的落点，可以使用 `IPostGenerateGradleAndroidProject` 在 Gradle 工程生成后复制文件并验证目标位置。回调里应：

- 根据导出目录计算路径，不嵌入用户名和工程绝对路径。
- 文件不存在时立即让构建失败。
- 记录源文件哈希和目标模块，不输出签名或其他 secret。
- 在 Unity / AGP 升级后重新检查生成结构。

## 绝对路径方案的边界

历史记录通过 Editor 脚本生成本机 `proguard-user-local.txt`，其中写入字典绝对路径，并把该文件加入 `.gitignore`。这个方案只有在规则始终从本机项目目录读取时才可靠，存在这些风险：

- Jenkins 工作区、开发者目录和导出工程目录不同。
- 规则文件被复制到 Gradle 中间目录后，绝对路径仍指向原工作区。
- 本地忽略文件缺失时，构建结果取决于谁先打开过项目。
- 路径可能出现在日志或缓存中，降低构建可复现性。

若短期必须使用，应在构建入口显式生成并校验，禁止静默依赖 `InitializeOnLoadMethod`，同时把它记录为待移除的兼容措施。

## 修复后的验证

1. 删除 `Library` 并在干净检出上构建 release，避免旧中间文件掩盖问题。
2. 保存最终合并的 R8 配置，确认每条 dictionary 指令只引用预期文件。
3. 检查 APK / AAB 能启动并覆盖反射、序列化、JNI 和第三方 SDK 路径。
4. 保存对应的 `mapping.txt`，用一个已知混淆堆栈做 retrace。
5. 在 Jenkins 上重复构建，确保不依赖开发者用户名和绝对路径。

`NoSuchFileException` 说明的是“最终 R8 任务看不到文件”。修复应落在产生这份最终配置的模块和复制流程，而不是继续向随机目录添加副本。
