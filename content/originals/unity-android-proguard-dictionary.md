---
id: 'unity-android-proguard-dictionary'
title: 'Android 代码混淆字典配置（原始正文，已脱敏）'
updatedAt: null
captureMethod: 'mcp-text'
---

> MCP 返回纯文本，没有图片或附件引用。下面整理了换行和代码块；本机用户名、项目名、绝对路径及重复堆栈已替换为说明，方案本身未按当前结论改写。

## 问题描述

正常 Android 打包配置如下：

```text
-obfuscationdictionary proguard-dict.txt
-classobfuscationdictionary proguard-dict.txt
-packageobfuscationdictionary proguard-dict.txt
```

但是直接使用 Unity 打包时，`Assets/Plugins/Android/proguard-dict.txt` 不会自动复制到对应的目录，导致打包时报错 `NoSuchFileException`。

```text
[已隐去本机用户名、项目名和绝对路径]/Library/Bee/Android/Prj/IL2CPP/Gradle/
unityLibrary/build/intermediates/consumer_proguard_dir/release/
exportReleaseConsumerProguardFiles/lib1/proguard-dict.txt

Execution failed for task ':launcher:minifyReleaseWithR8'.
R8: java.nio.file.NoSuchFileException: [已隐去重复绝对路径]/proguard-dict.txt
```

## 原记录的解决方案

要解决这个问题需要将混淆字典的路径配置成绝对路径，但是考虑到项目需要多人协作，做如下处理。

### 1. mainTemplate.gradle 配置

```groovy
defaultConfig {
    minSdkVersion **MINSDKVERSION**
    targetSdkVersion **TARGETSDKVERSION**
    ndk {
        abiFilters **ABIFILTERS**
    }
    versionCode **VERSIONCODE**
    versionName '**VERSIONNAME**'
    consumerProguardFiles 'proguard-unity.txt', 'proguard-user-local.txt'**USER_PROGUARD**
}
```

在 `consumerProguardFiles` 中增加 `proguard-user-local.txt`。

### 2. 添加 .gitignore 配置

```text
Assets/Plugins/Android/proguard-user-local.txt
Assets/Plugins/Android/proguard-user-local.txt.meta
```

避免提交 `proguard-user-local.txt`；这个文件由 Unity 脚本生成，每个开发者的混淆字典绝对路径不同。

### 3. 脚本生成本地配置

原记录使用 Editor 脚本，在项目打开、菜单操作和 Build 前调用同一生成方法。核心内容为：

```csharp
private const string LocalProguardFileName = "proguard-user-local.txt";
private const string DictFileName = "proguard-dict.txt";

private static string TargetDirPath =>
    Path.Combine(Application.dataPath, "Plugins", "Android");

private static string LocalProguardFilePath =>
    Path.Combine(TargetDirPath, LocalProguardFileName);

private static string DictFileAbsPath =>
    Path.Combine(TargetDirPath, DictFileName);

private static void GenerateLocalProguardConfig()
{
    if (!Directory.Exists(TargetDirPath))
        Directory.CreateDirectory(TargetDirPath);

    if (!File.Exists(DictFileAbsPath))
    {
        Debug.LogError($"[ProGuard] 未找到混淆字典文件：{DictFileAbsPath}");
        return;
    }

    string configContent = $@"-obfuscationdictionary {DictFileAbsPath}
-classobfuscationdictionary {DictFileAbsPath}
-packageobfuscationdictionary {DictFileAbsPath}";

    configContent = configContent.Replace("\\", "/");
    File.WriteAllText(LocalProguardFilePath, configContent, Encoding.UTF8);
}
```

将代码放到 Editor 目录下，在打包时自动创建 `proguard-user-local.txt` 并添加对应内容。
