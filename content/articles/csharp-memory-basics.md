---
id: csharp-memory-basics
title: C# 值类型、引用类型与 Unity 中的分配问题
topic: C# 与 Unity 面试基础
tags: [C#, Unity, 内存管理]
summary: 从赋值语义出发，理解值类型、引用类型和装箱，再把知识连接到 Unity 的性能排查。
updatedAt: '2026-10-22'
verifiedAt: '2026-10-22'
sample: true
applicability: C# 基础语义；Unity 性能部分参考 2022.3 文档，实际分配以目标 Player 测量为准。
sources:
  - title: Microsoft · C# 值类型
    url: https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types
  - title: Microsoft · C# 类型规范
    url: https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/types
  - title: Unity 2022.3 · 垃圾回收最佳实践
    url: https://docs.unity3d.com/2022.3/Documentation/Manual/performance-garbage-collection-best-practices.html
---

## 先从赋值发生了什么开始

值类型变量保存值本身，普通赋值会复制这个值。引用类型变量保存对象的引用，普通赋值会复制引用，两个变量因此可能指向同一个对象。这是理解它们的起点。[参考：C# 类型规范](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/types)

下面用 Unity 常见的 `Vector3` 说明值复制。修改 `second` 的坐标，不会同步修改 `first`。

```csharp
Vector3 first = new Vector3(1f, 2f, 3f);
Vector3 second = first;
second.x = 8f;

Debug.Log(first.x);  // 1
Debug.Log(second.x); // 8
```

## 值复制也有边界

如果结构体含有引用类型字段，复制结构体时复制的是那个字段的引用，两个结构体仍可能共享内部对象。传参时使用 `ref` 也会改变普通按值传递的行为。[参考：C# 值类型](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types)

面试时，先讲变量保存什么、赋值复制什么，再结合具体代码分析。仅凭类型名称推断内存所在位置，容易遗漏装箱、字段和运行时优化等条件。

## 把语义连接到性能问题

理解语义之后，还需要测量实际行为。在 Unity 中，先在目标设备记录稳定场景，再查看 CPU Profiler 的分配信息，沿调用栈找出频繁分配的代码。每帧拼接字符串、重复创建临时集合、发生装箱的调用，都是值得检查的候选点。[参考：Unity 分配优化](https://docs.unity3d.com/2022.3/Documentation/Manual/performance-garbage-collection-best-practices.html)

## 留下一份可以复用的排查记录

每次排查记录四件事：运行环境、复现步骤、分配位置、修改前后的对比。测试前明确想改善的指标，例如每帧托管分配；同时观察耗时和行为，确认优化带来的实际效果。

## 用自己的话讲一次

试着先回答“普通赋值分别复制什么”，再解释结构体里的引用字段，最后说出你会如何验证 Unity 中的一次分配。下面的五道关联题，可以帮助你把概念整理成面试表达。
