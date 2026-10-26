---
id: 'unity-jenkins-macos-build'
title: '在 macOS 上用 Jenkins 构建 Unity'
topic: '工程工具'
domainId: 'engineering'
categoryId: 'automation'
noteType: 'guide'
tags: ['Jenkins', 'Unity', 'macOS', 'CI', '构建自动化']
summary: '从构建机账号、Unity 命令行、Jenkins Pipeline、凭据隔离到制品留存，整理一条可审计的 macOS Unity 构建流程。'
updatedAt: '2026-10-26'
verifiedAt: null
sample: false
applicability: '适用于通过 Unity Hub 安装 Editor、使用 Jenkins Pipeline 的 macOS 构建机。原记录来自一台具体机器，本轮未在空白 macOS 主机上重装 Jenkins，也未执行真实 Unity 项目构建和上传。'
sources:
  - kind: personal
    title: '有道云笔记：Jenkins 安装、Unity 环境、流水线与制品上传记录（敏感原文不公开）'
  - kind: external
    title: 'Jenkins：在 macOS 上安装'
    url: 'https://www.jenkins.io/doc/book/installing/macos/'
  - kind: external
    title: 'Jenkins：Credentials Binding Plugin'
    url: 'https://www.jenkins.io/doc/pipeline/steps/credentials-binding/'
  - kind: external
    title: 'Unity 6：Editor 命令行参数'
    url: 'https://docs.unity3d.com/cn/6000.0/Manual/EditorCommandLineArguments.html'
---

> 原记录已经跑通过一条具体项目流水线，但同时包含机器路径、局域网地址、上传密钥和通知地址。本文只保留可复用结构，并把凭据管理改成 Jenkins 的标准做法。

## 先定义构建机边界

一台稳定的 Unity 构建机至少要固定以下输入：

| 输入              | 建议做法                                               |
| ----------------- | ------------------------------------------------------ |
| macOS 与 CPU 架构 | 记录系统版本和 Apple Silicon / Intel                   |
| Unity Editor      | 固定完整版本，不使用“最新版本”作为流水线条件           |
| Android 工具链    | 记录 Unity 使用的 JDK、SDK、NDK 与 Gradle 版本         |
| 项目源码          | Jenkins 每次从干净工作区检出明确的提交                 |
| Unity License     | 使用适合当前许可证类型的官方激活方式，限制文件权限     |
| 签名与上传凭据    | 只存 Jenkins Credentials，不写进脚本、参数默认值或仓库 |

构建服务最好使用独立的 macOS 用户。这个账号只获得项目目录、Unity、签名材料和目标上传服务所需的最小权限，避免 Jenkins 继承个人桌面账号中的钥匙串、SSH 配置和云盘文件。

## 安装与本机初始化

Jenkins 官方 macOS 页面把安装器维护指向外部方案，因此实际安装命令应以页面当前链接为准。使用 Homebrew 时，常见流程是：

```sh
brew install jenkins-lts
brew services start jenkins-lts
```

首次从 `http://localhost:8080` 完成解锁、插件安装和管理员创建。初始密码的位置以 Jenkins 启动日志或解锁页面提示为准，不要把密码复制进团队文档。

默认只允许本机访问更适合初始化。确需局域网访问时，再配置监听地址、防火墙、反向代理和 HTTPS，并限制可信网络。简单地监听 `0.0.0.0` 会扩大暴露范围，不应单独作为“允许其他电脑访问”的完整方案。

## 固定 Unity 路径

Unity Hub 默认安装位置下的可执行文件格式为：

```text
/Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/MacOS/Unity
```

先在构建机终端验证：

```sh
"$UNITY_PATH" -version
```

`UNITY_PATH` 可以配置为受控的 Jenkins 全局环境变量，或放进仓库级 Pipeline 配置。无论放在哪里，都要让版本变更出现在代码评审或构建机变更记录中。只写一个随时可变的软链接，会让同一提交产生不同结果。

## 最小 Pipeline 骨架

构建方法应放在项目的 `Editor` 程序集中，由命令行通过 `-executeMethod` 调用。Jenkinsfile 只负责编排，不承载大段 Unity 业务逻辑：

```groovy
pipeline {
  agent { label 'mac-unity' }

  environment {
    UNITY_PATH = '/Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/MacOS/Unity'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build') {
      steps {
        sh '''
          set -eu
          "$UNITY_PATH" \
            -batchmode -nographics -quit \
            -projectPath "$WORKSPACE" \
            -executeMethod BuildEntry.BuildAndroid \
            -logFile "$WORKSPACE/artifacts/unity.log"
        '''
      }
    }

    stage('Archive') {
      steps {
        archiveArtifacts artifacts: 'artifacts/**', fingerprint: true
      }
    }
  }

  post {
    always { junit allowEmptyResults: true, testResults: 'artifacts/test-results.xml' }
  }
}
```

Unity 构建入口需要在失败时抛出异常或返回非零退出码。流水线还应记录 Git 提交、Unity 版本、目标平台、应用版本、构建号和产物哈希；只看到“脚本执行结束”不能证明产物可安装。

## 上传凭据不进入命令文本

上传测试包或发送通知时，把 token、Webhook、账号和密码存入 Jenkins Credentials，并只在最小步骤中绑定：

```groovy
withCredentials([string(credentialsId: 'artifact-upload-token', variable: 'UPLOAD_TOKEN')]) {
  sh '''
    set +x
    ./ci/upload-artifact.sh "$UPLOAD_TOKEN" artifacts/app.aab
  '''
}
```

`set +x` 可以减少 shell 回显，但它不能替代权限隔离。还要避免：

- 把 secret 拼到 URL、文件名、异常消息或构建描述中。
- 在同一节点运行不可信任务，让其他进程读取临时环境或工作区。
- 长期复用范围过大的个人 token。
- 把带签名信息、配置文件或上传响应的整个工作区公开归档。

## 构建可靠性检查

1. 在干净工作区构建同一提交两次，确认依赖与产物来源可追踪。
2. 主动制造一次编译失败，确认 Jenkins 任务失败且仍保留 Editor 日志。
3. 让上传服务返回非 2xx，确认流水线不会把上传失败标为成功。
4. 在目标设备安装或从内测渠道下载产物，验证启动、版本号与签名。
5. 轮换测试凭据，确认旧值失效且 Jenkinsfile 无需修改。
6. 升级 Unity 或 Android 工具链前，复制任务做对照构建，再更新固定版本。

这套流程的目标是让每个产物能回答“由哪个提交、哪套工具链、哪次任务生成”，并让密钥只在需要它的短暂步骤中出现。
