---
title: '第 2 期：macOS 通过 AList 本地挂载 115 网盘指南'
description: 'Apple Silicon 架构下免编译部署 AList，打通 WebDAV 并实现 Finder 虚拟磁盘与开机自启完整方案'
pubDate: '2026-10-09 22:10:00'
heroImage: '../../assets/blog-placeholder-4.jpg'
---

> **摘要**：在 macOS 环境下，由于 115 网盘官方未提供虚拟磁盘功能，通常通过开源聚合文件程序 **AList** 驱动 115 并暴露标准 WebDAV 接口，再经由 macOS Finder 或第三方挂载工具映射为本地磁盘。本文记录从独立二进制部署、密码重置、凭证抓取到 launchd 开机守护进程配置的完整实践。

---

## 一、为什么避开 `brew` 与官方一键脚本？

在 macOS 终端安装 AList 时，常遇到以下两类典型环境问题：

1. **Homebrew 官方未收录**：直接执行 `brew install alist` 会提示 `Warning: No available formula with the name "alist"`。
2. **官方 Shell 脚本架构判断异常**：运行 `curl -fsSL "https://alist.nn.ci/v3.sh" | sudo bash` 时，提示 `一键安装目前仅支持 x86_64 和 arm64 平台`。这是因为该脚本主要面向 Linux 发行版，在 macOS 环境下 `uname` 检测逻辑可能失准。

> **最佳实践**：直接下载针对 Apple Silicon (ARM64) 编译的单独立可执行文件，绿色环保、无依赖且无需系统 Root 权限。

---

## 二、部署与初始化 AList

### 1. 下载与解压二进制程序

打开终端，在用户目录中创建专用程序文件夹：

```bash
# 创建并进入工作目录
mkdir -p ~/alist && cd ~/alist

# 下载 macOS ARM64 架构二进制文件
curl -L -o alist.tar.gz "https://github.com/alist-org/alist/releases/latest/download/alist-darwin-arm64.tar.gz"

# 解压并赋予可执行权限
tar -zxvf alist.tar.gz
chmod +x alist
```

### 2. 设置管理员账户密码

首次启动前，通过 CLI 快速重置管理员密码：

```bash
./alist admin set 你的自定义密码
```

> **常见日志提示**：  
> 若命令输出中包含 `[del_user_cache_online] failed: ... connection refused`，这属于正常现象。由于当前服务尚未在后台运行，内部清除缓存的 HTTP 端口未响应，但管理员密码已安全写入底层 SQLite 数据库。

### 3. 运行服务与面板验证

```bash
./alist server
```

当终端输出 `start server@0.0.0.0:5244` 时，说明后端服务已就绪：

* **控制台地址**：`http://127.0.0.1:5244`
* **默认账号**：`admin`
* **登录密码**：上一步设置的密码

---

## 三、挂载 115 网盘存储

### 1. 新增存储源

登录 AList 控制台后，依次进入 **管理 $\rightarrow$ 存储 $\rightarrow$ 添加**，关键参数配置如下：

| 配置项 | 填写值 | 说明 |
| :--- | :--- | :--- |
| **驱动** | `115网盘` | 核心适配驱动 |
| **挂载路径** | `/115` | 显示在 WebDAV 根目录下的文件夹名称 |
| **WebDAV 策略** | `302 重定向` | 视频串流直接使用网盘 CDN，不消耗本机带宽 |
| **根文件夹 ID** | `0` | 默认代表网盘根目录 |

### 2. 获取 115 鉴权凭证（Cookie）

1. 浏览器打开并登录 [115网盘官网](https://115.com)。
2. 按快捷键 <kbd>Cmd</kbd> + <kbd>Option</kbd> + <kbd>I</kbd> 打开开发者工具，切至 **Network (网络)** 标签页。
3. 刷新页面（<kbd>Cmd</kbd> + <kbd>R</kbd>），选中任意请求目标为 `115.com` 的请求项。
4. 在右侧 **Headers $\rightarrow$ Request Headers** 中复制完整的 `Cookie` 键值对字符串（形如 `USERSESSIONID=...; UID=...; CID=...;`）。
5. 回到 AList 添加界面，将内容粘贴至 **Cookie** 输入框（下方的“二维码令牌”保留为空）。
6. 点击 **添加** 按钮完成配置。

> **状态核验**：回到“存储”列表，若 `/115` 状态变为绿色标签 **work**，即表明已成功联通。

---

## 四、本地挂载至 macOS 文件系统

AList 默认集成了 WebDAV 服务，服务端口与管理端一致，访问路径为 `/dav`。

### 方案 A：macOS 原生 Finder 挂载（轻量文件读取）

1. 在访达桌面按快捷键 <kbd>Cmd</kbd> + <kbd>K</kbd> 呼出“连接服务器”窗口。
2. 输入服务器地址：
   ```text
   http://127.0.0.1:5244/dav
   ```
3. 身份选择 **已注册用户**，输入配置的 AList 账号与密码。
4. 连接成功后，桌面上将挂载虚拟磁盘，进入 `/115` 即可直接按本地目录结构浏览文件。

### 方案 B：专业挂载工具与流媒体播放（推荐）

* **Mountain Duck / CloudMounter**：相比 macOS 自带 WebDAV，具有更完备的本地缓存策略与锁机制，能够提供接近本地磁盘的随机读写体验。
* **Infuse / IINA**：若主要用于 4K 原画观影，建议直接在播放器中添加 WebDAV 媒体源（`http://127.0.0.1:5244/dav/115`），支持海报墙自动刮削与高速播放。

---

## 五、长期运维：配置 launchd 开机后台自启

为了避免重启系统后需手动启动终端执行程序，可通过系统原生守护进程管理工具配置自启动：

### 1. 生成守护进程 plist 文件

```bash
cat <<EOF > ~/Library/LaunchAgents/com.alist.server.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.alist.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$HOME/alist/alist</string>
        <string>server</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$HOME/alist</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/alist/alist.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/alist/alist.error.log</string>
</dict>
</plist>
EOF
```

### 2. 注册并载入服务

```bash
launchctl load -w ~/Library/LaunchAgents/com.alist.server.plist
```

注册后，AList 将在系统开机登录时在后台静默运行并写入对应日志。如需停止或卸载，只需执行 `launchctl unload ~/Library/LaunchAgents/com.alist.server.plist`。