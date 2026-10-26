---
id: 'unity-external-dependency-manager'
title: 'Dependencies.xml 与 EDM4U 记录（两份原始正文，已脱敏）'
updatedAt: null
captureMethod: 'mcp-text'
---

> 两份 MCP 响应都是纯文本，没有图片或附件引用。第一份的公开示例和问题记录如下；示例中的虚构私有 CocoaPods 地址已删除。第二份包含内部 Maven 地址、项目名和内部插件配置，因此只列出不敏感的原文要点，不逐字公开。

## 第一份：Dependencies.xml 配置

原记录引用的完整案例：

```text
https://github.com/googlesamples/unity-jar-resolver/blob/master/sample/Assets/ExternalDependencyManager/Editor/SampleDependencies.xml
```

Android 部分示例：

```xml
<dependencies>
  <androidPackages>
    <repositories>
      <repository>https://repo.maven.apache.org/maven2</repository>
    </repositories>

    <androidPackage spec="com.google.android.gms:play-services-games:9.8.0">
      <androidSdkPackageIds>
        <androidSdkPackageId>extra-google-m2repository</androidSdkPackageId>
      </androidSdkPackageIds>
      <repositories>
        <repository>https://maven.google.com</repository>
      </repositories>
    </androidPackage>
  </androidPackages>
</dependencies>
```

原记录中的精简案例：

```xml
<dependencies>
  <androidPackages>
    <androidPackage spec="com.unity3d.ads-mediation:mediation-sdk:8.10.0" />
    <androidPackage spec="com.google.android.gms:play-services-ads-identifier:18.1.0">
      <repositories>
        <repository>https://maven.google.com/</repository>
      </repositories>
    </androidPackage>
  </androidPackages>

  <iosPods>
    <iosPod name="IronSourceSDK" version="8.10.0.0">
      <sources>
        <source>https://github.com/CocoaPods/Specs</source>
      </sources>
    </iosPod>
  </iosPods>
</dependencies>
```

问题记录：

```text
Dependencies 放置位置：
如果是项目，可以放到项目的 Editor 目录下。
如果是插件，也可以放到 Assets 下的 Editor 目录下，项目依赖时会正常解析。

仓库凭证：
EDM4U 暂不支持这种添加凭证的仓库。
https://github.com/googlesamples/unity-jar-resolver/issues/406
需要自己在 mainTemplate.gradle 中添加。
```

## 第二份：EDM4U 介绍

这份原记录的非敏感主题包括：

```text
- EDM4U 用于汇总 Unity 插件声明的 Android 与 iOS 外部依赖。
- Android 依赖通过 Maven 坐标解析，iOS 依赖通过 CocoaPods 解析。
- 项目需要检查解析后的依赖版本与 Gradle 构建结果。
- 私有 Maven 仓库需要额外处理凭据。
```

其余内容涉及内部仓库、项目与插件配置，未进入公开对照。
