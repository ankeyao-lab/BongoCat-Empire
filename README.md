# BongoCat Empire

<p align="center">
  <img src="docs/images/hero-astronaut-idle.png" width="430" alt="BongoCat Empire：航天主题的桌面猫咪">
</p>

<p align="center">
  <strong>把 MacBook 的每一次输入，变成一只会成长、会换装的桌面猫咪。</strong><br>
  A desktop BongoCat for Mac with touchpad feedback, collectible growth, and 108 outfits.
</p>

<p align="center">
  <a href="https://github.com/ankeyao-lab/BongoCat-Empire/releases/tag/v1.8.3">下载 v1.8.3</a> ·
  <a href="#安装">安装</a> ·
  <a href="#为什么用它">功能</a> ·
  <a href="#致谢与许可">致谢</a>
</p>

## 为什么用它

| MacBook 触摸板联动                                                                       | 养成与收藏                                                                                |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ![触摸板联动：右爪贴合触摸板](docs/images/macbook-trackpad.png)                          | ![成长页：等级、进度与永久收藏](docs/images/growth-collection.png)                        |
| 鼠标、触摸板移动、点击、拖拽和滚动会让右爪即时回到设备上。停止操作后，默认双爪自然举起。 | 有效按键会积累本地成长进度。每个主题都有 9 个等级，可查看下一阶段、已收藏装扮和养成轮次。 |

| 12 个主题，108 套装扮                                                     | 中英文与可配置动作                                                                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ![主题衣橱：多套主题装扮](docs/images/theme-wardrobe.png)                 | ![闲置举爪设置：A 双爪与 B 单爪](docs/images/idle-paw-setting.png)                                    |
| 从原始外观、星际宇航、航海海盗到“称帝之路”，每个主题都有完整的 9 级换装。 | 界面可在简体中文与 English 间即时切换。闲置时默认 A「举双爪」，也可选 B「仅举左爪」，设置会自动保存。 |

### 输入不止是按键动画

- **为 MacBook 触摸板设计**：右爪跟随触摸板/鼠标输入；点击、拖拽、滚动时保持接触，停止约 600 ms 后回到闲置姿态。
- **四种输入模式**：键盘＋触摸板、键盘＋鼠标、双手键盘、手柄。不同模式保留各自的爪位与按键反馈。
- **不遮脸、不挡装扮**：闲置举爪使用原版肉垫爪型，并固定在袖口前侧；表情与主题装扮始终完整可见。
- **离线、本地保存**：无需账号和网络连接。成长进度、衣橱、阈值和偏好都保存在本机。

## 安装

适用于 Apple Silicon Mac（macOS 12 或更高版本）。

1. 在 [v1.8.3 Release](https://github.com/ankeyao-lab/BongoCat-Empire/releases/tag/v1.8.3) 下载 `BongoCat-Empire-1.8.3-macos-arm64.zip` 与 `SHA256SUMS.txt`。
2. 解压后将 **BongoCat Empire.app** 移至“应用程序”。
3. 首次打开时，前往「系统设置 → 隐私与安全性 → 输入监控」，允许 **BongoCat Empire** 读取输入事件，以启用键盘、触摸板、鼠标和滚动反馈。

安装包为本地 ad-hoc 签名，尚未公证。若 macOS 拦截首次启动，请在 Finder 中按住 Control 点击应用，再选择“打开”。下载页提供 SHA-256 校验文件。

## 版本与验证

当前版本为 **1.8.3**。已通过 TypeScript、32 项单元测试、5 项真实 Vue 输入回归、11 项中英文设置检查，以及 324 帧主题/姿态渲染检查。详见 [RELEASE_NOTES.md](RELEASE_NOTES.md)。

## 致谢与许可

BongoCat Empire 的核心代码基于 [ayangweb/BongoCat](https://github.com/ayangweb/BongoCat) 改造，并遵循其 [MIT License](LICENSE)。

项目中的猫咪模型与创作生态也受到 [ayangweb/Awesome-BongoCat](https://github.com/ayangweb/Awesome-BongoCat) 的启发；该仓库是 BongoCat 相关模型、工具与资源的重要目录。这里明确致谢两位上游项目及其贡献者。

---

![BongoCat](https://socialify.git.ci/ayangweb/BongoCat/image?custom_description=&description=1&font=Source+Code+Pro&forks=1&issues=1&logo=https%3A%2F%2Fgithub.com%2Fayangweb%2FBongoCat%2Fblob%2Fmaster%2Fsrc-tauri%2Fassets%2Flogo-mac.png%3Fraw%3Dtrue&name=1&owner=1&pattern=Floating+Cogs&pulls=1&stargazers=1&theme=Auto)

<div align="center">
  <div>
    <a href="https://github.com/ayangweb/BongoCat/releases"><img alt="Windows" src="https://img.shields.io/badge/-Windows-blue?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB0PSIxNzI2MzA1OTcxMDA2IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjE1NDgiIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cGF0aCBkPSJNNTI3LjI3NTU1MTYxIDk2Ljk3MTAzMDEzdjM3My45OTIxMDY2N2g0OTQuNTEzNjE5NzVWMTUuMDI2NzU3NTN6TTUyNy4yNzU1NTE2MSA5MjguMzIzNTA4MTVsNDk0LjUxMzYxOTc1IDgwLjUyMDI4MDQ5di00NTUuNjc3NDcxNjFoLTQ5NC41MTM2MTk3NXpNNC42NzA0NTEzNiA0NzAuODMzNjgyOTdINDIyLjY3Njg1OTI1VjExMC41NjM2ODE5N2wtNDE4LjAwNjQwNzg5IDY5LjI1Nzc5NzUzek00LjY3MDQ1MTM2IDg0Ni43Njc1OTcwM0w0MjIuNjc2ODU5MjUgOTE0Ljg2MDMxMDEzVjU1My4xNjYzMTcwM0g0LjY3MDQ1MTM2eiIgcC1pZD0iMTU0OSIgZmlsbD0iI2ZmZmZmZiI+PC9wYXRoPjwvc3ZnPg==" /></a>
    <a href="https://github.com/ayangweb/BongoCat/releases"><img alt="MacOS" src="https://img.shields.io/badge/-MacOS-black?style=flat-square&logo=apple&logoColor=white" /></a>
    <a href="https://github.com/ayangweb/BongoCat/releases"><img alt="Linux" src="https://img.shields.io/badge/-Linux-yellow?style=flat-square&logo=linux&logoColor=white" /></a>
  </div>

  <p>
    <a href="./LICENSE"><img src="https://img.shields.io/github/license/ayangweb/BongoCat?style=flat-square" /></a>
    <a href="https://github.com/ayangweb/BongoCat/releases/latest"><img src="https://img.shields.io/github/package-json/v/ayangweb/BongoCat?style=flat-square"/></a>
    <a href="https://github.com/ayangweb/BongoCat/releases"><img src="https://img.shields.io/github/downloads/ayangweb/BongoCat/total?style=flat-square"/></a>
  </p>

  <p>
    <a href="https://trendshift.io/developers/8507" target="_blank"><img src="https://trendshift.io/api/badge/developers/8507" alt="ayangweb | Trendshift" width="250" height="55" /></a>
    <a href="https://trendshift.io/repositories/14605" target="_blank"><img src="https://trendshift.io/api/badge/repositories/14605" alt="ayangweb%2FBongoCat | Trendshift" width="250" height="55" /></a>
    <a href="https://hellogithub.com/repository/7d23863fd4be47b39e816193ded385c9" target="_blank">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=7d23863fd4be47b39e816193ded385c9&claim_uid=5ihRVIuTYBmSGtQ&theme=dark" />
        <source media="(prefers-color-scheme: light)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=7d23863fd4be47b39e816193ded385c9&claim_uid=5ihRVIuTYBmSGtQ&theme=neutral" />
        <img alt="Star History Chart" src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=7d23863fd4be47b39e816193ded385c9&claim_uid=5ihRVIuTYBmSGtQ&theme=neutral" width="250" height="55" />
      </picture>
    </a>
  </p>
</div>

| macOS                                                                                        | Windows                                                                                        | Linux(x11)                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ![macOS](https://i0.hdslb.com/bfs/openplatform/dff276b96d49c5d6c431b74b531aab72191b3d87.png) | ![Windows](https://i0.hdslb.com/bfs/openplatform/a4149b753856ee7f401989da902cf3b5ad35b39e.png) | ![Linux](https://i0.hdslb.com/bfs/openplatform/3b49f961819d3ff63b2b80251c1cc13c27e986b0.png) |

## 赞助商

<a href="https://www.toolsetlink.com">
  <img height="54" alt="UpgradeLink" src="https://github.com/user-attachments/assets/6b84fb0f-3f1d-44b5-9932-2298bc999d8d" />
</a>

## 开发背景

本项目的灵感来源于 [MMmmmoko](https://github.com/MMmmmoko) 大佬开发的 [Bongo-Cat-Mver](https://github.com/MMmmmoko/Bongo-Cat-Mver)。它以独特的猫咪互动功能深受用户喜爱，但仅支持 Windows 平台。作为一名深度 macOS 用户，我特别希望在自己的设备上也能使用这款可爱的猫咪，于是我决定开发一个适配 macOS 的版本。

同时，得益于 [Tauri](https://github.com/tauri-apps/tauri) 强大的跨平台能力，本项目不仅支持 macOS，还兼容 Windows 和 Linux(x11)，让更多的用户都能与这只可爱的猫咪互动！

## 下载

- [夸克网盘](https://pan.quark.cn/s/70f2f2663ce1)
- [GitHub Releases](https://github.com/ayangweb/BongoCat/releases)

不确定下载哪一个？请查阅[下载指南](.github/DOWNLOAD_GUIDE.md)。

## 功能介绍

- 适配 macOS、Windows 和 Linux(x11)。
- 根据键盘、鼠标或手柄的操作，同步对应的动作。
- 支持导入自定义模型，自由打造专属猫咪形象。
- 完全开源，代码公开透明，绝不收集任何用户数据。
- 支持离线运行，无需联网，保护用户隐私。

## 模型转换

如果你想将 Bongo-Cat-Mver 应用中的模型转换为兼容 BongoCat 的格式，可以使用以下工具：

🔗 [在线转换](https://bongocat.vteamer.cc)

## 更多模型

你可以在这个仓库中探索、下载更多猫咪模型，或提交你的创作，与大家一起分享：

📦 [Awesome-BongoCat](https://github.com/ayangweb/Awesome-BongoCat)

## 社区交流

<table>
  <thead>
    <tr>
      <th>QQ 群 1</th>
      <th>QQ 群 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <a href="https://qm.qq.com/q/AS3gNv2Vzy">
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcset="https://i0.hdslb.com/bfs/openplatform/8ecdc4982ab01b59d7731fcca3ec26631a274560.png"
            />
            <source
              media="(prefers-color-scheme: light)"
              srcset="https://i0.hdslb.com/bfs/openplatform/09f56580397063e1819c4c2ed63d07dee12720e1.png"
            />
            <img
              alt="QQ Group 1"
              src="https://i0.hdslb.com/bfs/openplatform/09f56580397063e1819c4c2ed63d07dee12720e1.png"
              height="250"
            />
          </picture>
        </a>
      </td>
      <td>
        <a href="https://qm.qq.com/q/TmltLAod2O">
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcset="https://i0.hdslb.com/bfs/openplatform/473c522487ff33e0f32b15466aeb0734f17161c8.png"
            />
            <source
              media="(prefers-color-scheme: light)"
              srcset="https://i0.hdslb.com/bfs/openplatform/d5ae8c5af6ae1d0a1f066705ee822d1287384cf6.png"
            />
            <img
              alt="QQ Group 2"
              src="https://i0.hdslb.com/bfs/openplatform/d5ae8c5af6ae1d0a1f066705ee822d1287384cf6.png"
              height="250"
            />
          </picture>
        </a>
      </td>
    </tr>
  </tbody>
</table>

## 赞赏

每一份认可都值得被珍视！赞赏随缘，心意无价，谢谢你的支持 ❤️

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://i0.hdslb.com/bfs/openplatform/e7438bff14cdfb6bfd0feacbb482f99ea4093294.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://i0.hdslb.com/bfs/openplatform/da55cc3ec1556580c91e59f589792866c998c7c6.png" />
  <img alt="微信赞赏码" src="https://i0.hdslb.com/bfs/openplatform/da55cc3ec1556580c91e59f589792866c998c7c6.png" height="250" />
</picture>

## 贡献指南

感谢大家为 BongoCat 做出的宝贵贡献！如果你也希望为 BongoCat 做出贡献，请查阅[贡献指南](.github/CONTRIBUTING.md)。

<a href="https://openomy.com/ayangweb/BongoCat" target="_blank" style="display: block; width: 100%;" align="center">
  <img src="https://openomy.com/svg?repo=ayangweb/BongoCat&chart=bubble" alt="Contribution Leaderboard" style="display: block; width: 100%;" />
</a>

## 历史星标

<a href="https://www.star-history.com/#ayangweb/BongoCat&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=ayangweb/BongoCat&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=ayangweb/BongoCat&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=ayangweb/BongoCat&type=Date" />
 </picture>
</a>
