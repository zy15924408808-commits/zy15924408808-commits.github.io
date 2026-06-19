---
title: 从点亮一颗 LED 开始
date: 2026-06-18
description: 第一篇笔记，记录我学习嵌入式的起点与一些心得。
tags: [嵌入式, 单片机, 学习笔记]
---

> 这是一篇示例文章。你可以直接在 Obsidian 里写新文章，把 `.md` 文件放进 `src/content/blog/` 文件夹，网站就会自动生成对应页面。

## 为什么从 LED 开始

几乎每个嵌入式入门教程都从“点亮一颗 LED”讲起。它简单，却完整地包含了嵌入式开发的核心流程：

1. 配置时钟
2. 初始化 GPIO
3. 控制电平输出

```c
// STM32 HAL 库点灯示例
HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);
HAL_Delay(500);
HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
HAL_Delay(500);
```

## 一点心得

- **先跑起来，再求甚解**：先让代码工作，再回头理解每行的含义。
- **看数据手册**：寄存器、时序图是嵌入式工程师的第一手资料。
- **多动手**：嵌入式是实践的学科，仿真不能替代真实硬件。

写代码的同时记得记笔记，半年后的你会感谢现在的你。
