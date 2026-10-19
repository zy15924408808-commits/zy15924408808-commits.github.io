---
title: UART + DMA 空闲接收机制
date: 2026-10-12
tags:
  - 嵌入式
  - C语言
  - 串口
  - dma
description: ''
draft: true
category: 单片机
---
## 1. 解决什么问题？

普通串口中断接收通常需要逐字节处理数据。

当接收的数据长度不固定时，例如电机控制器返回的数据、ESP32 AT 指令响应，就需要一种方便的接收方式。

UART + DMA 配合空闲中断，可以减少逐字节搬运数据的 CPU 开销，并方便处理不定长数据。

## 2. 核心概念

### UART

负责串行数据的发送和接收。

### DMA

负责在 UART 数据寄存器与内存缓冲区之间搬运数据，减少 CPU 逐字节处理的工作量。

### IDLE 空闲事件

当 UART 接收线路在接收过数据后出现规定的空闲时间时，可以触发空闲事件。

在 STM32 HAL 中，`HAL_UARTEx_ReceiveToIdle_DMA()` 可以启动 DMA 接收，并结合接收长度或空闲事件通知应用层。

## 3. 典型启动代码

```c
#define UART_RX_BUF_SIZE 128

uint8_t uart_rx_buf[UART_RX_BUF_SIZE];

void UART_StartReceive(void)
{
    HAL_UARTEx_ReceiveToIdle_DMA(
        &huart1,
        uart_rx_buf,
        UART_RX_BUF_SIZE
    );
}
```

注意：需要使用支持该 API 的 STM32 HAL 版本，并正确配置 UART、DMA 和中断。

## 4. 接收回调

```c
void HAL_UARTEx_RxEventCallback(
    UART_HandleTypeDef *huart,
    uint16_t Size)
{
    if (huart->Instance == USART1)
    {
        /*
         * Size 表示本次接收事件对应的数据长度。
         * 应先检查长度，再解析数据。
         *
         * 不要在这里进行耗时操作。
         */
    }
}
```

`Size` 表示本次接收事件对应的数据长度，不一定代表缓冲区已经装满。

## 5. 数据接收流程

1. 调用 `HAL_UARTEx_ReceiveToIdle_DMA()` 启动接收。
    
2. UART 收到数据，DMA 将数据搬运到缓冲区。
    
3. 达到接收缓冲区长度或发生空闲事件时，HAL 通知应用层。
    
4. `HAL_UARTEx_RxEventCallback()` 获取本次接收长度。
    
5. 应用层检查数据、解析协议并处理命令。
    
6. 根据 HAL 版本和接收模式，正确处理下一次接收。
    

## 6. 常见问题

### 问题一：回调没有触发

检查：

- UART 是否正确初始化。
    
- DMA 通道或 Stream 是否映射正确。
    
- DMA 和 UART 对应中断是否使能。
    
- 是否调用了接收启动函数。
    
- 是否使用了正确的 HAL 回调名称。
    

### 问题二：数据丢失或被覆盖

检查：

- 是否在 DMA 继续写入时处理同一块缓冲区。
    
- 是否正确处理半传输、传输完成和空闲事件。
    
- 是否存在缓冲区越界。
    
- 数据处理速度是否跟得上接收速度。
    

### 问题三：接收一次后不再接收

检查接收模式、DMA 配置以及 HAL 版本的行为。普通 Normal DMA 模式下，接收完成后通常需要重新启动接收；具体处理要以当前 HAL 的实现为准。

## 7. 与 FreeRTOS 配合

如果串口接收的数据需要复杂解析，可以考虑：

1. 回调中快速记录接收长度或发送任务通知。
    
2. 将数据安全地交给处理任务。
    
3. 在任务中完成协议解析和业务处理。
    

注意：DMA 缓冲区的所有权、数据复制时机以及缓存覆盖问题必须处理正确，不能只传递一个指针就认为数据已经安全。

## 8. 关联笔记

- [[STM32与外设驱动]]
    
- [[实时操作系统]]
    
- [[通信与网络协议]]
    

## 9. 实践记录

- 使用的 MCU：
    
- UART：
    
- DMA 模式：
    
- 缓冲区大小：
    
- 实际测试现象：
    
- 遇到的问题及解决方法：