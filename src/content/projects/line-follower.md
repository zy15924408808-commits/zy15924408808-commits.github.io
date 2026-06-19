---
title: 循迹小车
description: 基于红外传感器的自动循迹小车，PID 控制实现平滑转向。
order: 2
stack: [51单片机, C, PID, PWM]
repo: https://github.com/yourname/line-follower
---

这是第二个示例项目。

## 项目简介

四路红外传感器检测黑线位置，通过 PID 算法计算偏差并调整左右电机 PWM，实现平滑循迹。

## 技术要点

- 红外传感器阵列采样与去抖
- PID 参数整定（先 P 后 I 再 D）
- PWM 调速与电机驱动

## 收获

理解了反馈控制的思想，调 PID 参数的过程让我对“理论 vs 实际”有了体会。
