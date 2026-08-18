---
title: 【STM32】之如何将数据通过printf打印到串口
date: 2026-08-13
description: 将数据通过printf打印到串口
tags:
  - 嵌入式
  - C语言
  - 串口
---
>通过printf将数据打印出来，可以用来进行一些调试。
>例如：
>1.当我们想知道代码有没有运行到某一个函数里面的时候，就可以在这个函数里面写一个printf，来打印输出，从而判断有没有运行到这个函数里面。
>2.当我们想知道代码的运行顺序，也可以添加多个printf来判断顺序。

>C语言中的printf是将内容输出到控制台里面的，但是STM32是没有控制台的，我们可以将printf的内容输出到串口，进而来模拟控制台。

# C语言中printf的本质
>printf的本质：本身不会“打印到屏幕”，它只是把数据按照指定格式转换成字符，然后通过底层输出函数把这些字符送出去。
>printf("ABC")
    ↓
>格式化
    ↓
>得到 'A' 'B' 'C'
    ↓
>调用 fputc() 输出每个字符
    ↓
>输出到控制台

# STM32中使用printf
>所以在stm32中我们要想将数据通过printf打印到串口，本质上就是将fputc()输出的每个字符，从串口发送出去。
>所以我们就要重写fputc()→把printf的字符输出到串口，这个过程叫“printf 重定向”。

## printf重定向

>在Keli中打开MicroLIB选项，MicroLIB是缺省C库的备选库，用于必须在极少量内存环境下运行的深层嵌入式程序开发。printf函数是基于C库实现的，所以这里需要勾选。

代码：
基于寄存器实现
```c
#include <stdio.h>

void USART_SendChar(uint8_t ch)
{
    //判断SR里面TXE是否为1
    while(!(USART1->SR & USART_SR_TXE)){ /*等待*/ }
    //向DR写入新的要发送的数据
    USART1->DR = ch;
}

int fputc(int ch,FILE * file)
{
    // 直接将字符发送到串口
    USART_SendChar(ch);//发送字符函数
    return ch;
}
```
基于HAL库实现
```c
#include <stdio.h>
int fputc(int ch, FILE *file)
{
  HAL_UART_Transmit(&huart1,(uint8_t *)&ch,1,HAL_MAX_DELAY);
  return ch;
}
```