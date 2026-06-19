---
title: 理解 RTOS 中的任务调度
date: 2026-06-10
description: 用最直白的方式理解 FreeRTOS 的抢占式调度是怎么回事。
tags: [嵌入式, RTOS, FreeRTOS]
---

> 这是第二篇示例文章，演示多篇文章和标签的效果。

## 什么是任务调度

在裸机程序里，`main` 函数里的 `while(1)` 是唯一的循环。而在 RTOS 中，多个任务看起来“同时”运行，背后是调度器在快速切换。

## 抢占式调度

FreeRTOS 默认使用**抢占式调度**：高优先级任务就绪时，会立刻打断正在运行的低优先级任务。

```c
// 创建两个不同优先级的任务
xTaskCreate(vTaskLED,  "LED",  128, NULL, 1, NULL);
xTaskCreate(vTaskUART, "UART", 256, NULL, 2, NULL); // 优先级更高
vTaskStartScheduler();
```

## 小结

- 任务有优先级，调度器总是运行就绪态中优先级最高的任务。
- 相同优先级的任务按时间片轮转。
- 善用 `vTaskDelay` 让出 CPU，避免饿死低优先级任务。
