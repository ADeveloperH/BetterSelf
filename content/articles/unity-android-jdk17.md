---
id: 'unity-android-jdk17'
title: 'Unity Android：JDK 与 Gradle 切换记录（历史）'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'build'
noteType: 'troubleshooting'
tags: ['Unity', 'Android', 'JDK', 'Gradle']
summary: '记录 Editor 中切换 JDK、Gradle 和启用模板的步骤，区分运行 JDK、AGP 与 Java 编译目标，并说明兼容风险、验证和回退。'
updatedAt: '2026-10-27'
verifiedAt: null
sample: false
applicability: '历史配置记录；文档核对 AGP 8.7 与 Unity 2022.3 / 6000.0 版本边界。未提供原项目、准确 Editor 小版本或构建日志，未复现构建。'
sources:
  [
    { 'kind': 'personal', 'title': '有道云笔记历史记录' },
    {
      'kind': 'external',
      'title': 'Unity 2022.3：自定义 Android 依赖',
      'url': 'https://docs.unity3d.com/2022.3/Documentation/Manual/android-customize-dependencies.html',
    },
    {
      'kind': 'external',
      'title': 'Unity 2022.3：Android Player 模板设置',
      'url': 'https://docs.unity3d.com/2022.3/Documentation/Manual/class-PlayerSettingsAndroid.html',
    },
    {
      'kind': 'external',
      'title': 'Unity 2022.3：Gradle 工程概览',
      'url': 'https://docs.unity3d.com/2022.3/Documentation/Manual/android-gradle-overview.html',
    },
    {
      'kind': 'external',
      'title': 'Android：AGP 8.7 兼容表',
      'url': 'https://developer.android.com/build/releases/agp-8-7-0-release-notes',
    },
    {
      'kind': 'external',
      'title': 'Unity：Android 依赖支持版本',
      'url': 'https://docs.unity3d.com/6000.0/Documentation/Manual/android-supported-dependency-versions.html',
    },
    {
      'kind': 'external',
      'title': 'Gradle 8.9：构建环境配置',
      'url': 'https://docs.gradle.org/8.9/userguide/build_environment.html',
    },
  ]
---

> 这是一次历史构建排查记录。配置项和失败尝试来自原文，最终是否成功构建尚无记录。

## 原环境与切换目标

案例使用的是 Unity Editor 2022，默认是 Jdk 11 ，gradle 是 7。想修改成 jdk 17，gradle 8。

原记录尝试借用 Unity 6000 的 JDK / Gradle 配置，迁回 Unity 2022；这只能描述当时的尝试，不构成 Unity 2022 支持整个替换组合的证据。

## Gradle 目录与模板配置

### External Tools 目录

历史记录尝试使用 Unity Editor 6000 附带的工具目录，未记录原来的完整路径、Gradle 小版本或最终成功日志。下面补充手动操作方法，不能把操作可完成视为该组合已受支持。

**Editor 中怎么改：**

1. 先记录当前 Unity 完整版本、两个 `Installed with Unity` 勾选状态和原路径；保留一份能构建的基线。
2. Windows / Linux 打开 `Edit > Preferences > External Tools`；macOS 打开 `Unity > Settings > External Tools`，部分旧 Editor 菜单名为 `Preferences`。
3. 在 `Android` 区域取消 `JDK Installed with Unity (recommended)`，用 `Browse` 选择 JDK 根目录。目录应包含 `bin/java`，不要选 `bin` 或 `java` 可执行文件本身。
4. 如确需更换 Gradle，再取消 `Gradle Installed with Unity (recommended)`，选择包含 `bin`、`lib` 的 Gradle 发行版根目录。这里不能填写 AGP 的 `8.7.2`。
5. 记录每次变更后实际构建使用的路径。External Tools 是当前电脑的 Editor 偏好设置，提交项目不会自动让 CI 和同事机器使用相同工具。

**作用与取值：** JDK 路径选择 Java 工具；Gradle 路径选择构建程序。原文目标是 JDK 11 → 17、Gradle 7 → 8，但只有 AGP 8.7.2 的值明确，不能补写一个“已成功”的 Gradle 8.9 配置。默认优先使用当前 Editor 配套版本；跨大版本替换需要单独验证。

**可能的问题：** 旧 Unity 构建脚本、第三方插件或 Gradle DSL 可能无法适配新工具链；只满足 AGP 最低版本要求，仍可能在导出、R8 或打包阶段失败。全局偏好也可能影响同一 Editor 打开的其他项目。

入口依据：[Unity 2022.3：自定义 Android 依赖](https://docs.unity3d.com/2022.3/Documentation/Manual/android-customize-dependencies.html)。

![原笔记截图](assets/unity-android-jdk17/cd337144e7f04ce9.png)

`gradleTemplate.properties` 中的 `org.gradle.java.home` 可指定 Gradle 构建进程使用的 JDK 路径；它与选择 Gradle 安装目录、Java 源代码编译目标是不同配置。还需检查 External Tools 实际配置及最终导出工程。

### baseProjectTemplate.gradle

**先在 Editor 启用对应模板：** 打开 `Edit > Project Settings > Player`，选择 `Android` 页签，展开 `Publishing Settings > Build`。启用 `Custom Base Gradle Template` 后，检查 `Assets/Plugins/Android/baseProjectTemplate.gradle`；要写 JDK 属性时启用 `Custom Gradle Properties Template`，检查同目录的 `gradleTemplate.properties`。如果项目已有文件，先做版本备份，不能假定重新勾选会覆盖为新版本。

模板选项控制 Unity 是否使用项目中的自定义内容。它不负责自动升级所有插件或处理版本冲突。启用前的状态未记录，本轮只是补写步骤，没有替原项目启用这些开关。

原记录中的插件版本配置：

```text
plugins {
    // If you are changing the Android Gradle Plugin version, make sure it is compatible with the Gradle version preinstalled with Unity
    // See which Gradle version is preinstalled with Unity here https://docs.unity3d.com/Manual/android-gradle-overview.html
    // See official Gradle and Android Gradle Plugin compatibility table here https://developer.android.com/studio/releases/gradle-plugin#updating-gradle
    // To specify a custom Gradle version in Unity, go do "Preferences > External Tools", uncheck "Gradle Installed with Unity (recommended)" and specify a path to a custom Gradle version
    id 'com.android.application' version '8.7.2' apply false
    id 'com.android.library' version '8.7.2' apply false
    **BUILD_SCRIPT_DEPS**
}
```

原记录备注：“同步对应的版本为 8”。AGP 的 `8.7.2` 不是 Gradle 发行版号；仅写 Gradle“8”不足以判断兼容。

模板与最终工程应逐层对照：

| 要改什么         | 项目模板                     | 导出结果与检查点                                 |
| ---------------- | ---------------------------- | ------------------------------------------------ |
| AGP 插件版本     | `baseProjectTemplate.gradle` | 根 `build.gradle` 的插件声明                     |
| Gradle JVM 属性  | `gradleTemplate.properties`  | 根 `gradle.properties` 的 `org.gradle.java.home` |
| Unity 库模块     | `mainTemplate.gradle`        | `unityLibrary/build.gradle`                      |
| Android 启动模块 | `launcherTemplate.gradle`    | `launcher/build.gradle`                          |

后两个模板分别对应 `Custom Main Gradle Template` 和 `Custom Launcher Gradle Template`。不要为改 JDK 而无目的地全部启用。生成结构依据：[Unity 2022.3：Gradle 工程概览](https://docs.unity3d.com/2022.3/Documentation/Manual/android-gradle-overview.html)。

### Java 编译目标

原记录称在 mainTemplate.gradle 和 baseProjectTemplate.gradle 修改下列值，但没有给出完整配置位置；不能据此照抄到根项目模板。应用 / 库模块的 Java `compileOptions` 中才通常设置 sourceCompatibility 与 targetCompatibility。它们控制 Java 源码和字节码目标，不负责选择运行 Gradle 的 JDK：

```text
JavaVersion.VERSION_17
```

## JDK 路径：尝试与结果

### 环境变量尝试（原记录失败）

gradleTemplate.properties 添加 jdk 文件设置

```text
org.gradle.java.home=$OpenJdk17
```

原记录结果：此尝试失败。这里不是 shell 脚本，属性文件中的 `$OpenJdk17` 不会按 shell 规则自动展开。[Gradle 8.9 配置文档](https://docs.gradle.org/8.9/userguide/build_environment.html)分别描述了 JDK 路径属性和环境变量；若由脚本生成配置，应先解析实际路径再写入。本文保留失败行供对照。

### 改用绝对路径（最终构建结果未记录）

原记录改为以下路径：

```text
org.gradle.java.home=/Applications/Unity/Hub/Editor/6000.0.59f2/PlaybackEngines/AndroidPlayer/OpenJDK
```

**作用与风险：** 这条属性指定 Gradle 构建进程的 Java home，不修改 Java 编译目标。绝对路径只能在对应安装存在的机器上使用；照搬到 Windows、CI 或另一台 Mac 会失败。还要检查用户级 `gradle.properties`、命令行参数和构建脚本是否有其他覆盖，不能只根据 `JAVA_HOME` 判断实际 JVM。

## 官方版本要求与配置边界

| 配置层次                 | 已核对的范围                  | 本记录尚缺的证据                                           |
| ------------------------ | ----------------------------- | ---------------------------------------------------------- |
| AGP 8.7 系列（含 8.7.2） | 最低 Gradle 8.9、JDK 17       | 实际使用的 Gradle 完整版本与构建进程 JDK                   |
| Unity 6000.0             | 官方 JDK 支持表为 OpenJDK 17  | 本地 6000.0.59f2 安装内容和路径是否存在                    |
| Unity 2022.3 LTS         | 官方 JDK 支持表为 OpenJDK 11  | 原文只有“2022”，不清楚分支 / patch，不能断言其支持整体替换 |
| Java 编译目标            | 与 Gradle 的运行 JDK 分别配置 | 最终 launcher / unityLibrary 的 compileOptions、插件兼容性 |

依据：[AGP 8.7 发布说明的兼容表](https://developer.android.com/build/releases/agp-8-7-0-release-notes)、[Unity Android 依赖支持表](https://docs.unity3d.com/6000.0/Documentation/Manual/android-supported-dependency-versions.html)。这些要求能排除“任意 Gradle 8 都兼容”的判断，不能证明原 Unity 工程已构建成功。

原绝对路径只作为历史记录：不同机器或 Editor 安装布局下需要确认路径和 `bin/java`。本轮未检查本机 Unity 安装，也未运行 Unity / Gradle 构建。

## 怎么确认配置生效

1. 准确的 Unity Editor 版本、Android Build Support、原有插件与模板。
2. 将工程导出到新的空目录。若产物有 wrapper，在导出根目录运行 `./gradlew --version`（Windows 为 `gradlew.bat --version`）；没有 wrapper 时，用 External Tools 实际选择的 Gradle 的 `bin/gradle --version`，不要调用 PATH 中另一份 Gradle。
3. 最终生成的 AGP、Gradle、JDK、Java 编译配置；逐项变更并记录结果。
4. `launcher`、`unityLibrary` 编译、打包与设备运行结果。

`--version` 用于核对工具版本；最终还要结合 Unity Editor 构建日志、Gradle daemon 日志中的 Java home 和真正的构建任务，确认运行构建的 JVM。终端中 `java -version` 正确并不能证明 Unity 使用同一份 JDK。

## 如何回退

1. 恢复变更前 External Tools 的路径和勾选状态；原来使用 Unity 配套工具时重新勾选相应的 `Installed with Unity (recommended)`。
2. 同时恢复 `org.gradle.java.home`、AGP 插件版本、模块编译目标及模板开关；只改回 JDK 路径可能仍被属性覆盖。
3. 使用新的导出目录构建，必要时停止对应 Gradle daemon 后重试，保留失败日志与成功基线对照。
4. 回归第三方 Android 插件、Release 打包与设备启动。没有证据时不通过删除整个 Unity `Library` 来替代定位。

缺少上述工程和日志，因此本篇继续归类为历史问题排查，绝对路径方案保持“最终结果未记录”。
