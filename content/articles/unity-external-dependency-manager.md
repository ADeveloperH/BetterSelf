---
id: 'unity-external-dependency-manager'
title: 'Unity 外部依赖管理：从 EDM4U 到官方 EDM'
topic: 'Unity 开发'
domainId: 'unity'
categoryId: 'native'
noteType: 'guide'
tags: ['Unity', 'EDM', 'EDM4U', 'Gradle', 'CocoaPods', '依赖管理']
summary: '整理 Dependencies.xml 的放置与写法、依赖解析边界，以及从 Google EDM4U 迁移到 Unity 官方 EDM 的检查步骤。'
updatedAt: '2026-10-26'
verifiedAt: null
sample: false
applicability: 'Unity 官方 EDM 支持 Unity 2022.3 及更高版本；旧版 Unity 或仍捆绑 EDM4U 的 SDK 需要按实际兼容矩阵决定。本文未在包含多个商业 SDK 的真实项目中完成迁移。'
sources:
  - kind: personal
    title: '有道云笔记：Dependencies.xml 配置与 EDM4U 使用记录（已脱敏）'
  - kind: external
    title: 'Unity：External Dependency Manager 迁移说明'
    url: 'https://unity.com/blog/external-dependency-manager'
  - kind: external
    title: 'Unity 6：External Dependency Manager 包'
    url: 'https://docs.unity.com/en-us/engine/6000.0/manual/packages-list/packages-all/pack-safe/com-unity-external-dependency-manager'
  - kind: external
    title: 'Google EDM4U 仓库'
    url: 'https://github.com/googlesamples/unity-jar-resolver'
---

> 历史记录使用 Google 的 External Dependency Manager for Unity（EDM4U）。2026 年 Unity 已提供官方 External Dependency Manager（EDM），包名为 `com.unity.external-dependency-manager`。官方实现基于 EDM4U，并兼容原有 XML 依赖声明。

## 它解决什么问题

Unity 插件常同时依赖 Android Maven、iOS CocoaPods 或 Swift Package。每个 SDK 都手工复制 AAR、JAR 和 framework，会造成版本冲突、重复类以及无法追踪的二进制文件。

EDM 让插件在文本文件中声明平台依赖，再交给 Gradle、CocoaPods 或 Swift Package Manager 解析。它负责汇总声明和驱动平台工具，不会替你判断两个 SDK 的业务兼容性，也不会让无凭据的构建机自动访问私有仓库。

## Dependencies.xml 的最小结构

依赖文件名通常以 `Dependencies.xml` 结尾，并放在插件或项目的 `Editor` 目录中，让 Editor 侧扫描工具能够发现：

```text
Assets/
└── MyPlugin/
    └── Editor/
        └── MyPluginDependencies.xml
```

Android Maven 依赖示例：

```xml
<dependencies>
  <androidPackages>
    <androidPackage spec="com.example:example-sdk:1.2.3">
      <repositories>
        <repository>https://repo.maven.apache.org/maven2</repository>
      </repositories>
    </androidPackage>
  </androidPackages>
</dependencies>
```

iOS CocoaPods 依赖示例：

```xml
<dependencies>
  <iosPods>
    <iosPod name="ExampleSDK" version="~> 1.2" />
  </iosPods>
</dependencies>
```

SDK 作者应使用自己真实发布的坐标、版本范围和官方仓库。应用项目可以集中约束冲突版本，但不要直接修改 `Library` 或解析后的临时 Gradle 文件，因为重新解析后会丢失。

## 私有仓库与凭据

历史笔记遇到过带凭据的 Maven 仓库。不要把用户名、密码或 token 写入 `Dependencies.xml`、`mainTemplate.gradle` 或仓库 URL。更稳妥的做法是：

- 在 Gradle 支持的用户级或 CI 凭据存储中注入 secret。
- 让仓库地址与凭据分开，源码只包含无密钥的仓库标识。
- 为下载账号设置只读、最小仓库范围和过期时间。
- 在 CI 中关闭命令回显，并检查 Gradle 异常是否泄露 URL 查询参数。

EDM 能声明“去哪里解析”，但私有仓库认证仍由底层构建系统和组织的凭据方案负责。

## 从 EDM4U 迁移到官方 EDM

Unity 官方说明，EDM 支持 Unity 2022.3+，能读取 EDM4U 使用的 XML。迁移可按以下顺序进行：

1. 在 Package Manager 从 Unity Registry 安装 **External Dependency Manager**。
2. 项目同时存在 EDM 与 EDM4U 时，选择当前激活的依赖管理器。
3. 执行一次 Android Resolver 和 iOS 依赖生成，保存解析前后差异。
4. 构建 Android 与 iOS，核对最终依赖树、重复类和原生插件。
5. 确认所有 SDK 已兼容后，再移除自行安装的 EDM4U。

如果 EDM4U 是某个 SDK 自带的文件，先升级 SDK 或与供应方确认；直接删除可能在下次导入 SDK 时恢复，也可能破坏其预期目录结构。

Unity 6 当前包列表显示官方 EDM 2.1.1，但项目应让 Package Manager 按实际 Editor 版本选择兼容版本，不能把文档页上的最新数字直接写死到所有分支。

## 冲突排查

当 Android 出现重复类、找不到类或解析到错误版本时，按产物链路排查：

1. 搜索所有 `*Dependencies.xml`，列出每个 SDK 请求的坐标和版本。
2. 查看 Gradle dependency tree，确认最终选择版本和引入路径。
3. 检查 `Assets/Plugins/Android` 是否还保留手工复制的同名 AAR / JAR。
4. 删除并重新生成解析产物，确认问题不是旧缓存。
5. 只在有兼容性证据时统一版本；强制版本可能让旧 SDK 在运行时崩溃。

iOS 同理，应查看最终 Podfile、lockfile 和 Xcode 链接结果，而不是只看 XML 写得是否正确。

## 验证清单

- 干净检出后，不依赖某位开发者的本机缓存即可解析。
- Android 和 iOS 的锁定结果或依赖树进入构建制品。
- 离线或仓库不可用时，构建明确失败且不泄露凭据。
- 升级任一 SDK 时，比较解析版本、二进制体积和运行时初始化日志。
- 发布包中不存在同一库的手工副本和解析副本。

依赖管理的结果要从最终 Gradle / CocoaPods / Xcode 图中确认。XML 是输入清单，不是依赖已经正确进入应用的证明。
