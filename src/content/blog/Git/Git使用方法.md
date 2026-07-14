---
title: Git使用方法
date: 2026-07-14
description: Git的基本使用方法
tags: [嵌入式, Git]
---

## Git工作流程

![[git-1.png]]

# Git常用命令
![[git-2.png]]
>1.设置用户信息 **git config --global user.name "----"**
>		     **git config --global user.email "----"**
>2.获取本地仓库 **git init**可以将本地目录作为Git仓库
>3.查看修改的状态（暂存区、工作区）**git status**
>4.添加工作区一个或多个文件的修改到暂存区**git add .**（将所有修改的文件添加到暂存区）、**git add 单个文件名**
>5.提交暂存区到本地仓库 **git commit - "注释内容"**
>6.查看提交日志git log[option]
> - options：
> - all显示所有分支、pretty=oneline将提交信息显示为一行
> - abbrev-commit 使得输出的commitld更简短
> - graph以图的形式显示
> **注：配置了别名git-log包含了这些参数**
> 7.版本切换 **git reset --hard commitID**
> 8.查看已经删除的记录 **git reflog**

## 分支命令
>1.查看本地分支**git branch**
>2.创建本地分支**git branch 分支名**
>3.切换分支 **git checkout 分支名**
>4.创建并切换分支 **git checkout -b分支名**
>5.合并分支**git merge 分支名称**
>6.删除分支(不能删除当前分支，只能删除其他分支) **git branch -d b1** 删除分支时，需要做各种检查、**git branch -D b1**不做任何检查，强制删除

# Git_GitHub
>给GitHub仓库链接创建别名 **git remote add 别名 仓库链接**
>删除GitHub仓库链接创建的别名 **git remote remove 别名**

>将本地库的代码推送到远程库 **git push 别名(或者GitHub仓库链接) 分支**
>

>拉取远程库到本地库：**git pull 别名 分支**
# GitHub完整的提交流程如下。
## 第一次上传项目（只做一次）

### ① 初始化 Git 仓库

```bash
git init
```

目录下会出现一个 `.git` 文件夹。
### ② 查看状态

```bash
git status
```

Git 会告诉你哪些文件没有被管理。
### ③ 添加到暂存区

全部添加：

```bash
git add .
```

或者添加某一个文件：

```bash
git add main.c
```
### ④ 提交到本地仓库

```bash
git commit -m "注释"
```

这一步只是保存到**本地 Git 仓库**，还没有上传到 GitHub。
### ⑤ 添加远程仓库

如果还没有添加：

```bash
git remote add 别名 https://github.com/你的用户名/仓库名.git
```

查看是否添加成功：

```bash
git remote -v
```
### ⑥ 第一次推送（建立跟踪关系）

```bash
git push -u 别名 main
```
以后 Git 就知道：
```text
本地 main
      │
      ▼
origin/main
```
## 以后每次开发

假设你改了几个文件。
### 查看修改

```bash
git status
```
例如：
```text
modified: main.c
modified: pid.c
```
### 添加到暂存区

```bash
git add .
```
### 提交

```bash
git commit -m "优化PID参数"
```
### 上传到 GitHub

```bash
git push
```

因为第一次已经建立了跟踪关系，所以不用再写：

```bash
git push origin main
```
## Git 的整体流程

```text
修改代码
    │
    ▼
git status
    │
    ▼
git add .
    │
    ▼
暂存区（Stage）
    │
    ▼
git commit -m "说明"
    │
    ▼
本地仓库（Repository）
    │
    ▼
git push
    │
    ▼
GitHub 远程仓库
```