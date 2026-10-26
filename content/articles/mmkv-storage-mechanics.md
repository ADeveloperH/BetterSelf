---
id: 'mmkv-storage-mechanics'
title: 'MMKV 存储机制：mmap、Protobuf 与追加写入'
topic: 'Android 开发'
domainId: 'android'
categoryId: 'storage-network'
noteType: 'concept'
tags: ['MMKV', 'mmap', 'Protobuf', 'CRC', 'SharedPreferences']
summary: '整理 MMKV 如何借助 mmap、Protobuf 编码、追加写入和文件重整保存键值数据，并区分性能、空间与持久性边界。'
updatedAt: '2026-10-26'
verifiedAt: null
sample: false
applicability: '基于 Tencent MMKV 公开设计文档与当前仓库说明整理，适合作为机制概览；未绑定具体 MMKV 版本，未进行 Android 设备基准、故障注入或多进程实验。'
sources:
  [
    { 'kind': 'personal', 'title': '有道云笔记：MMKV 基本原理介绍' },
    { 'kind': 'external', 'title': 'Tencent MMKV 仓库', 'url': 'https://github.com/Tencent/MMKV' },
    {
      'kind': 'external',
      'title': 'Tencent MMKV：设计说明',
      'url': 'https://github.com/Tencent/MMKV/wiki/design',
    },
    {
      'kind': 'external',
      'title': 'Tencent MMKV：FAQ',
      'url': 'https://github.com/Tencent/MMKV/wiki/FAQ',
    },
    {
      'kind': 'external',
      'title': 'Protocol Buffers：编码说明',
      'url': 'https://protobuf.dev/programming-guides/encoding/',
    },
    {
      'kind': 'external',
      'title': 'Linux man-pages：mmap(2)',
      'url': 'https://man7.org/linux/man-pages/man2/mmap.2.html',
    },
    {
      'kind': 'external',
      'title': 'Linux man-pages：msync(2)',
      'url': 'https://man7.org/linux/man-pages/man2/msync.2.html',
    },
  ]
---

> 原笔记把 MMKV 与 SharedPreferences 的性能数字、Linux I/O、mmap、Protobuf 和文件扩容混在一起。本文保留可由公开设计资料支持的机制，删除缺少设备、版本和测试方法的“千次写入耗时”结论。

## 先看整体数据路径

MMKV 是键值存储组件。Tencent 的公开说明将核心路径概括为：用 `mmap` 建立文件映射，用 Protobuf 规则编码值，把新的键值记录追加到可用空间，并在空间不足时去重、重写或扩容。

```text
应用层 key/value
      ↓
值编码为字节序列
      ↓
KV 记录追加到 mmap 映射区
      ↓
内存中的索引提供读取
      ↓
数据文件 + 元信息文件（校验、加密 IV、多进程协调等）
```

这条路径解释了为什么它不等同于“把一个 Map 原样写成 XML”，也解释了为什么写入速度、文件占用和故障恢复需要分开讨论。

## mmap 解决了什么

`mmap` 把文件的一段内容映射到进程虚拟地址空间。程序可以通过内存访问方式读写映射区，内核负责页缓存、缺页和回写等工作。它减少了应用层在每次更新时显式组织 `read()` / `write()` 调用和缓冲区复制的负担，但不能简单等同于“零拷贝”或“写内存一样快”。

映射至少受这些因素影响：

- 映射偏移要满足页大小对齐要求，映射长度和文件空间按页管理可能带来空间余量。
- 首次访问可能触发缺页；内存压力、存储介质和内核回写都会影响延迟。
- 修改共享映射后，何时写回持久介质由系统和显式同步策略共同决定。`mmap` 本身不提供数据库事务语义，也不意味着所有断电场景都不会丢失最近更新。

MMKV 的价值不只来自 `mmap`。它还需要定义数据布局、索引、空间回收、校验和并发访问规则。

## Protobuf 在这里承担什么

MMKV 的设计说明把不同类型的 value 编码成统一的字节块，再与字符串 key 组成记录。Protobuf wire format 使用字段编号和 wire type 描述记录；整数可能使用 varint，字符串和字节序列使用长度前缀。

varint 每个字节的最高位表示后面是否还有字节，低 7 位承载数据。较小的非负整数通常占用更少字节，例如十进制 `150` 编码为两个字节 `0x96 0x01`。这只是 Protobuf 编码规则的一部分：`float`、`double`、`fixed32`、`fixed64` 和有符号整数的编码方式并不都相同，因此不能概括为“所有数字都是 1 到 5 字节”。

## 为什么采用追加写入

更新 key 时直接在可用空间末尾追加新记录，可以避免每次都重写整个文件。内存索引指向最新值，旧记录在下一次重整前仍可能留在文件中。

追加也会让文件不断增长。MMKV 公开设计给出的折中是：

1. 当前空间足够时，追加新记录。
2. 空间到达末尾时，按内存中的最新键值去重并重新序列化。
3. 去重结果能放回现有空间时，执行全量重写。
4. 仍放不下时扩大文件，再写入整理后的数据。

因此，“增量写入”与“全量写入”不是两个供调用者选择的 API 模式，而是组件内部在写入成本和文件空间之间做的决策。

## 校验与故障边界

MMKV 还使用元信息文件记录 CRC 等数据，以识别内容异常。CRC 能发现一部分损坏，不等于事务日志，也不能证明最近一次写入在所有崩溃、断电和文件系统情况下都完整持久化。

评估关键数据是否适合放在 MMKV 时，应先回答：

- 丢失最近一次写入能否接受？
- 是否需要多键原子提交、回滚或复杂查询？
- 是否存在多进程访问，所用版本和模式如何配置？
- 数据总量是否会造成明显常驻内存和文件描述符压力？
- 备份、恢复、加密和损坏回调是否已经设计？

需要事务和关系约束的数据更适合数据库。配置、状态开关和可重建缓存更符合键值存储的使用方式。

## 与 SharedPreferences 的比较方式

原笔记记录了一个没有测试环境的千次写入数字，不能作为通用结论。比较 MMKV 与 SharedPreferences 时至少要固定：

| 变量                              | 为什么必须记录               |
| --------------------------------- | ---------------------------- |
| 库版本与 Android 版本             | 实现可能变化                 |
| 数据类型、大小和 key 分布         | 编码与重写成本不同           |
| 单次 / 批量、冷 / 热启动          | 缓存和初始化会改变结果       |
| `apply()` / `commit()` 与等待条件 | 完成语义不同                 |
| 单进程 / 多进程                   | 锁与一致性成本不同           |
| 耗时分位数与线程                  | 平均值会掩盖长尾和主线程阻塞 |

性能测试应使用目标设备、接近真实的数据规模和明确的完成条件。没有这些信息，只保留机制分析，不保留“快多少倍”的数字。

## 与多进程笔记的关系

本文聚焦文件映射、编码和空间整理。线程同步、`flock` 与历史多进程实现见[MMKV：线程同步、文件锁与多进程摘记（历史）](#/article/mmkv-locks-and-processes)。两篇分别阅读，避免把通用存储机制和旧版锁实现混成一个超长页面。

## 核验状态

已按 MMKV 仓库、设计 Wiki、FAQ、Protobuf 编码文档和 Linux man-pages 核对机制描述；未核对某个确定版本的全部源码，也未做真机基准、强杀、断电或文件损坏实验。整理稿保持“未完整核验”。
