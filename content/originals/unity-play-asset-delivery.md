---
id: 'unity-play-asset-delivery'
title: 'PAD 打包（原始正文）'
updatedAt: null
captureMethod: 'mcp-text'
---

> MCP 返回纯文本，没有图片或附件引用。下面只整理换行；历史笔记中的菜单名称、模板修改和链接保持原意，当前建议请以整理稿为准。

## 参考文档

```text
参考文档：
https://medium.com/akatsuki-taiwan-technology/unity-play-asset-delivery-1d468fd90c2d

官方文档：
https://docs.unity3d.com/Manual/android-asset-packs-set-up.html

Gradle 模板变量：
https://docs.unity3d.com/Manual/gradle-templates.html
https://docs.unity3d.com/cn/2020.3/Manual/play-asset-delivery.html
```

## 需要修改

```text
1. Project Setting => Player => Publishing Settings 中，
   Split Application Binary 选项需要勾选。

或者在打包脚本中修改：
PlayerSettings.Android.useAPKExpansionFiles = true

和 Split Application Binary 是一个作用。

2. launcherTemplate.gradle 最下边修改。
```

原记录中的模板片段：

```groovy
**PACKAGING_OPTIONS**
**PLAY_ASSET_PACKS**
**SPLITS**
**BUILT_APK_LOCATION**

bundle {
    language {
        enableSplit = false
    }
    density {
        enableSplit = false
    }
    abi {
        enableSplit = true
    }
}

**SPLITS_VERSION_CODE**
**LAUNCHER_SOURCE_BUILD_SETUP**
```

增加 `PLAY_ASSET_PACKS` 标识。参考：

```text
https://docs.unity3d.com/Manual/android-asset-packs-set-up.html
https://docs.unity3d.com/Manual/gradle-templates.html
```
