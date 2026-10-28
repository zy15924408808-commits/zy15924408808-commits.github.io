---
title: FreeRTOS移植步骤和注意事项
date: 2026-10-28
tags:
  - FreeRTOS
description: ''
draft: false
category: FreeRTOS
---
**通用的 FreeRTOS 手工移植顺序是：获取官方源码 → 选择适配端口 → 配置内核 → 接入硬件节拍和中断 → 创建任务 → 分阶段验证。**

**1．从 FreeRTOS 官方 GitHub 获取代码**
官方仓库：

- [FreeRTOS-Kernel：内核源码](https://github.com/FreeRTOS/FreeRTOS-Kernel)
- [FreeRTOS：包含官方示例等内容的完整仓库](https://github.com/FreeRTOS/FreeRTOS)

**2．认识源码目录**

内核仓库中，主要关注这些内容：
```
FreeRTOS-Kernel/
├── include/             内核公共头文件
├── portable/            处理器、编译器适配代码和内存管理实现
├── tasks.c              任务管理和调度
├── list.c               内核链表
├── queue.c              队列、信号量和互斥量
├── timers.c             软件定时器
├── event_groups.c       事件组
└── stream_buffer.c      流缓冲区和消息缓冲区
```
**移植时通常不需要修改这些内核公共文件。** 主要工作是选择端口、编写配置文件、接入底层硬件。

**3．根据“处理器＋编译器”选择 portable 端口**

在 `portable/` 下，找到匹配以下条件的目录：

|条件|要核对的内容|
|---|---|
|处理器架构|Cortex-M、Cortex-A、RISC-V 等|
|具体内核能力|是否带 FPU、MPU、安全扩展等|
|编译器|GCC、IAR、Arm Compiler 等|
|编译设置|指令集、浮点 ABI、特权模式等|

按该端口的说明加入 `port.c`、`portmacro.h`，以及可能存在的汇编文件。

注意：

- 同一个工程只加入一套适用的端口实现。
- 不要因为芯片名称相近，就直接照搬另一个端口。
- 同一个 IDE 可以使用不同编译器；**IDE 名称不能单独决定端口选择。**
- 部分架构还需要配置中断控制器、定时器寄存器或链接脚本，必须查看所选端口的说明和官方示例。

**4．向工程加入内核文件和头文件路径**

最小任务调度工程通常先加入：

```
tasks.c
list.c
queue.c
```

然后根据需要加入：

```
timers.c
event_groups.c
stream_buffer.c
```

再加入上一步选定的端口文件。

配置编译器头文件搜索路径：

```
FreeRTOS-Kernel/include
所选 portable 端口目录
FreeRTOSConfig.h 所在目录
```

注意：**头文件加入搜索路径即可，不需要把所有 portable 目录都加入工程。**

**5．选择内存分配方式**

FreeRTOS 支持动态分配和静态分配，也可以同时启用。

初次移植，通常可以先使用动态分配，并选用：

```
portable/MemMang/heap_4.c
```

常见内存管理实现区别：

|实现|特点|
|---|---|
|`heap_1.c`|只分配，不释放|
|`heap_2.c`|支持释放，但不合并相邻空闲块|
|`heap_3.c`|使用 C 库的 `malloc/free`|
|`heap_4.c`|支持释放，并合并相邻空闲块|
|`heap_5.c`|支持多个不连续的内存区域|

注意：

- 采用官方动态内存实现时，一般只编译一个 `heap_x.c`。
- `heap_4` 的内存池大小通常由 `configTOTAL_HEAP_SIZE` 配置。
- `heap_3` 使用 C 库堆，不由 `configTOTAL_HEAP_SIZE` 决定。
- `heap_5` 需要先定义内存区域，再进行动态分配。
- 完全使用静态分配时，需要提供任务栈、控制块，以及配置要求的系统任务内存。

**6．创建 FreeRTOSConfig.h**

这个文件是**应用工程对 FreeRTOS 的配置**。

优先在[FreeRTOS：包含官方示例等内容的完整仓库](https://github.com/FreeRTOS/FreeRTOS)这个里面找到对应硬件的Demo然后移植FreeRTOS.h

重点检查：

|配置|作用及注意点|
|---|---|
|`configUSE_PREEMPTION`|是否使用抢占式调度，入门通常启用|
|`configTICK_RATE_HZ`|系统节拍频率|
|`configMAX_PRIORITIES`|任务优先级数量|
|`configMINIMAL_STACK_SIZE`|空闲任务等使用的基础栈大小|
|`configSUPPORT_DYNAMIC_ALLOCATION`|是否支持动态分配|
|`configSUPPORT_STATIC_ALLOCATION`|是否支持静态分配|
|`configTOTAL_HEAP_SIZE`|部分内存管理实现的内存池大小|
|`configUSE_TIMERS`|是否启用软件定时器|
|`configCHECK_FOR_STACK_OVERFLOW`|栈溢出检查|
|`configUSE_MALLOC_FAILED_HOOK`|内存分配失败钩子|
|`configASSERT`|检测配置和调用错误|
