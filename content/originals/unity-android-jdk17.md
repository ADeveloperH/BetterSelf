---
id: 'unity-android-jdk17'
title: 'Unity Android：切换 JDK 17 的构建记录'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'build'
noteType: 'guide'
tags: ['Unity', 'Android', 'JDK', 'Gradle']
summary: '记录 Unity 2022 工程调整 JDK、Gradle 和模板文件的操作及未成功的环境变量尝试。'
updatedAt: '2025-11-16'
verifiedAt: null
sample: false
applicability: '原记录涉及 Unity 2022 与 6000.0.59f2；版本兼容性和构建结果待验证。'
sources: [{ 'kind': 'personal', 'title': '有道云笔记历史记录' }]
---

案例使用的是 Unity Editor 2022，默认是 Jdk 11 ，gradle 是 7。想修改成 jdk 17，gradle 8。

因为 Unity Editor 6000 默认使用的 jdk 17 & gradle 8。这里就将 Unity Editor 6000 相关的配置同步修改到 Unity Editor 2022。

- Unity Editor 修改 Preferences -〉External Tools -〉修改 gradle 目录

这里使用的是 Unity Editor 6000 的配置

![原笔记截图](assets/unity-android-jdk17/cd337144e7f04ce9.png)

Jdk 的版本需要在 gradleTemplate.properties 文件进行修改

- baseProjectTemplate.gradle 文件修改

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
同步对应的版本为 8
```

- mainTemplate.gradle 和 baseProjectTemplate.gradle 文件修改 java 版本为

```text
JavaVersion.VERSION_17
```

- gradleTemplate.properties 添加 jdk 文件设置

```text
org.gradle.java.home=$OpenJdk17
上边这种方案不行，一直读取不到对应的环境变量，目前就使用绝对路径进行配置
org.gradle.java.home=/Applications/Unity/Hub/Editor/6000.0.59f2/PlaybackEngines/AndroidPlayer/OpenJDK
```
