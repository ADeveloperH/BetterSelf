---
id: "unity-android-jdk17"
title: "Unity Android：JDK 与 Gradle 切换记录（历史）"
topic: "Unity 开发"
domainId: "unity"
categoryId: "build"
noteType: "troubleshooting"
tags: ["Unity", "Android", "JDK", "Gradle"]
summary: "区分历史配置尝试与官方工具链要求：AGP 8.7 至少需要 Gradle 8.9、JDK 17，原 Unity 2022 迁移结果仍待实测。"
updatedAt: "2025-11-16"
verifiedAt: null
sample: false
applicability: "历史配置记录；文档核对 AGP 8.7 与 Unity 2022.3 / 6000.0 版本边界。未提供原项目、准确 Editor 小版本或构建日志，未复现构建。"
sources: [{"kind": "personal", "title": "有道云笔记历史记录"}, {"kind": "external", "title": "Android：AGP 8.7 兼容表", "url": "https://developer.android.com/build/releases/agp-8-7-0-release-notes"}, {"kind": "external", "title": "Unity：Android 依赖支持版本", "url": "https://docs.unity3d.com/6000.0/Documentation/Manual/android-supported-dependency-versions.html"}, {"kind": "external", "title": "Gradle 8.9：构建环境配置", "url": "https://docs.gradle.org/8.9/userguide/build_environment.html"}]
---

> 这是一次历史构建排查记录。配置项和失败尝试来自原文，最终是否成功构建尚无记录。

## 原环境与切换目标

案例使用的是 Unity Editor 2022，默认是 Jdk 11 ，gradle 是 7。想修改成 jdk 17，gradle 8。

原记录尝试借用 Unity 6000 的 JDK / Gradle 配置，迁回 Unity 2022；这只能描述当时的尝试，不构成 Unity 2022 支持整个替换组合的证据。

## Gradle 目录与模板配置

### External Tools 目录

Unity Editor 修改 Preferences -〉External Tools -〉修改 gradle 目录

这里使用的是 Unity Editor 6000 的配置

![原笔记截图](assets/unity-android-jdk17/cd337144e7f04ce9.png)

`gradleTemplate.properties` 中的 `org.gradle.java.home` 可指定 Gradle 构建进程使用的 JDK 路径；它与选择 Gradle 安装目录、Java 源代码编译目标是不同配置。还需检查 External Tools 实际配置及最终导出工程。

### baseProjectTemplate.gradle

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

## 官方版本要求与配置边界

| 配置层次 | 已核对的范围 | 本记录尚缺的证据 |
| --- | --- | --- |
| AGP 8.7 系列（含 8.7.2） | 最低 Gradle 8.9、JDK 17 | 实际使用的 Gradle 完整版本与构建进程 JDK |
| Unity 6000.0 | 官方 JDK 支持表为 OpenJDK 17 | 本地 6000.0.59f2 安装内容和路径是否存在 |
| Unity 2022.3 LTS | 官方 JDK 支持表为 OpenJDK 11 | 原文只有“2022”，不清楚分支 / patch，不能断言其支持整体替换 |
| Java 编译目标 | 与 Gradle 的运行 JDK 分别配置 | 最终 launcher / unityLibrary 的 compileOptions、插件兼容性 |

依据：[AGP 8.7 发布说明的兼容表](https://developer.android.com/build/releases/agp-8-7-0-release-notes)、[Unity Android 依赖支持表](https://docs.unity3d.com/6000.0/Documentation/Manual/android-supported-dependency-versions.html)。这些要求能排除“任意 Gradle 8 都兼容”的判断，不能证明原 Unity 工程已构建成功。

原绝对路径只作为历史记录：不同机器或 Editor 安装布局下需要确认路径和 `bin/java`。本轮未检查本机 Unity 安装，也未运行 Unity / Gradle 构建。

## 下次复现需要记录什么

1. 准确的 Unity Editor 版本、Android Build Support、原有插件与模板。
2. 从原项目导出的 Gradle 工程；有 wrapper 时优先用它，否则使用 Unity 实际配置的 Gradle，记录 `--version` 输出与构建日志中的 JDK 路径。
3. 最终生成的 AGP、Gradle、JDK、Java 编译配置；逐项变更并记录结果。
4. `launcher`、`unityLibrary` 编译、打包与设备运行结果。

缺少上述工程和日志，因此本篇继续归类为历史问题排查，绝对路径方案保持“最终结果未记录”。
