---
id: 'unity-addressables-remote-content'
title: 'Addressable 使用与资源动态下发（两份原始正文，已脱敏）'
updatedAt: null
captureMethod: 'mcp-text'
---

> 两份有道笔记的主体内容和链接相同，较长的一份在末尾多出三条问题记录。下面保留较长版本的原始文字并整理换行；本机用户名、项目名与绝对路径已替换为脱敏说明。较短版本没有额外独立内容。MCP 返回的是纯文本，没有图片或附件引用。

## 原始正文：远程内容与配置

```text
1.资源动态下发
官方文档：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/remote-content-intro.html

资源和逻辑热更 demo（未研究）：
https://github.com/ManoKing/FFramework

本地服务器搭建：
1.HFS（Http File Server）
2.Addressables Hosting：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetsHostingServices.html

本地资源打包路径：
Addressables Profiles 中配置的 LocalBuildPath：
[UnityEngine.AddressableAssets.Addressables.BuildPath]/[BuildTarget]
[已隐去本机项目绝对路径]

远程资源打包路径：
Addressables Profiles 中配置的 RemoteBuildPath：ServerData/[BuildTarget]
[已隐去本机项目绝对路径]

AddressableAssetSettings 配置：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetSettings.html

显示 log 添加宏：ADDRESSABLES_LOG_ALL

Play mode scripts
可寻址资产包有三个构建脚本，用于创建 Play mode 数据，以帮助用户加速应用程序开发。

Use Asset Database (faster)
Use Asset Database (BuildScriptFastMode) 允许你在游戏流程中快速运行游戏。它直接通过 Asset Database 加载 Asset，这会在不需要分析器或 AssetBundle 创建的情况下进行快速迭代。

Simulate Groups (advanced)
Simulate Groups mode (BuildScriptVirtualMode) 在不创建 AssetBundles 的情况下分析布局和依赖项的内容。Asset 通过 ResourceManager 从 AssetDatabase 加载，就假装它们是通过包加载的一样。若要查看游戏期间 bundles 加载或卸载的时间，请在 Addressables 事件查看器窗口查看 Asset 使用情况。Simulate Groups mode 可以帮助您模拟加载策略，并调整内容 groups 以找到生产和发行版的适当平衡。

Use Existing Build (requires built groups)
Use Existing Build 最接近于已部署的应用程序生成，但它要求你将数据作为单独的步骤进行构建。如果不修改 Asset，则此模式是最快的，因为它在进入 Play 模式时不处理任何数据。必须通过 Build > New Build > Default Build Script，或者在游戏脚本中使用 AddressableAssetSettings.BuildPlayerContent() 方法构建此模式的内容。

源码调试部分：
1.远程 URL
UnityEngine.ResourceManagement.ResourceProviders.AssetBundleResource.CreateWebRequest 断点可查看 URL。

配置部分：
1.Profile 配置：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetsProfiles.html

2.更改资源 URL：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/TransformInternalId.html

静态配置文件变量：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/ProfileVariables.html

ID transform method：ID 变换
WebRequest override：Web 请求覆盖

3.Addressable Asset Settings：启用远程分发
Enabling the remote catalog
Set up a remote group
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/remote-content-enable.html

4.远程内容 AssetBundle 缓存：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/remote-content-assetbundle-cache.html

5.Group 相关设置：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/GroupSchemas.html

6.Cache 设置：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/InitializeAsync.html?q=CacheInitializationSettings#cache-initialization-objects

逻辑处理：
1.处理下载错误：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/LoadingAssetBundles.html

2.预下载：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/DownloadDependenciesAsync.html
```

## 原始正文：更新、缓存与待验证项

```text
问题：
1.默认 bundle unitybuiltinshaders 会在 Update a Previous Build 后变更。
不能新增引用内置着色器。
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/build-shared-assetbundles.html?q=unitybuiltinshaders

2.增量更新的 bundle 是否只更新修改的文件
可以支持。Group 中需要勾选 Prevent Updates，这样使用 Update a Previous Build 时会将更改的文件移动到一个新的分组，只更新这个新的分组即可。
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/UpdateRestrictionSchema.html?q=prevent%20updates
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/content-update-build-create.html#check-for-content-update-restrictions-tool

3.增量更新是否会使下载的资源累计得越来越多
Group 分组 Cache Clear Behavior：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/ContentPackingAndLoadingSchema.html

4.远程下载的缓存路径：
Windows：[已隐去本机用户名、应用标识与缓存绝对路径]
Android：[已隐去测试应用标识与缓存绝对路径]

5.文件介绍
.hash 后缀的里面只包含一个 hash 值，是 catalog 文件的 hash 值，用于客户端检测 catalog 更新的时候会先对比这个 hash 值，才知道 catalog 文件有没有被修改，有修改才更新 catalog 文件。
.json 文件就是 catalog 文件了，里面记录了每个 AB 包的 hash 值、地址，以及 AB 包里有哪些资源。客户端通过对比这些值来检测是否有资源需要更新。

6.源码修改
修改加载 catalog 的路径：
UnityEngine.AddressableAssets.ResourceProviders.ContentCatalogProvider.InternalOp.Start

修改加载 bundle 的路径：
UnityEngine.AddressableAssets.Addressables.RuntimePath

7.SharpZipLib 导入失败
https://forum.unity.com/threads/how-to-import-3rd-party-library-package-from-source-sharpziplib-doesnt-have-a-dll.1237783/

Unity 插件：
https://docs.unity3d.com/Packages/com.unity.sharp-zip-lib@1.3/manual/index.html

SharpZipLib is an official Unity plugin (now?)：
只需使用包管理器（按“+”并选择“来自 Git URL”，然后输入：com.unity.sharp-zip-lib）。

待验证：
1.添加自己的 shader 是否可以支持远程更新。
2.更新完成后是否能下次使用最新的 bundle。
3.回退版本能否通过修改 catalog 实现。

Group 设置中 Asset Bundle CRC：
https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/ContentPackingAndLoadingSchema.html#assetbundle-crc
```

## 原始正文：问题记录

```text
2.1 UnityEditor 2022.3.28f1 Addressable 1.21.14
问题描述：打开 Addressable Groups 后 Console 出现 Error：
unity addressable Missing built-in guistyle ToolbarSeachTextFieldPopup

解决方案：
源码：
Packages/com.unity.addressables-1.21.14/Editor/GUI/AddressableAssetsSettingsLabelMaskPopup.cs
Packages/com.unity.addressables-1.21.14/Editor/GUI/AddressableAssetsSettingsGroupEditor.cs

将 GetStyle("ToolbarSeachxxxx")) 修改成 GetStyle("ToolbarSearchxxxx"))。
单词 Search 拼写错误导致无法获取到对应的 style。

2.2 UnityEditor 2022.3.28f1 Addressable 1.21.14
问题描述：打包时报错 Cannot read BuildLayout header, BuildLayout has not open for a file。
解决方案：关闭自动打开 Addressable Report 即可。

2.3 选择模式 Use Existing Build，在 Editor 下打开显示粉红色问题
问题原因：为特定平台构建的任何着色器都不能保证与其他平台兼容，Windows 下加载 Android 平台的会出现问题。
https://github.com/Unity-Technologies/Addressables-Sample/issues/46
https://forum.unity.com/threads/addressable-material-showing-pink.1437064/

解决方案：修改 Windows 的渲染模式。
https://docs.unity3d.com/550/Documentation/Manual/UsingDX11GL3Features.html
```
