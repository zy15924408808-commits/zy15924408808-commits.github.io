---
title: 智能温湿度监测器
description: 基于 STM32 的环境监测设备，采集温湿度并通过 OLED 实时显示。
order: 1
stack: [STM32, C, DHT11, OLED, I2C]
repo: https://github.com/yourname/temp-monitor
---

这是一个示例项目。把你的真实项目按同样的格式写进 `src/content/projects/` 即可。

## 项目简介

使用 STM32F103 采集 DHT11 温湿度传感器数据，通过 I2C 驱动 0.96 寸 OLED 屏幕实时显示，并在超过阈值时蜂鸣器报警。

## 我做了什么

- 编写 DHT11 单总线时序驱动
- 移植 OLED 显示库并优化刷新
- 实现阈值报警逻辑

## 收获

第一次完整地把传感器、显示、逻辑串成一个产品，理解了时序的重要性。
