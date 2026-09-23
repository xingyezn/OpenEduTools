# 第三方依赖：Mediabunny

本工具在浏览器本地读取、解码、编码和封装视频，依赖 [Mediabunny](https://mediabunny.dev/) 提供媒体容器读写与 WebCodecs 编排。

## 版本与来源

- 包名：`mediabunny`
- 版本：`1.59.0`
- 生产文件：`dist/bundles/mediabunny.min.cjs`（对应本目录 `mediabunny.min.js`，仅为扩展名调整，内容未修改）
- 获取方式：`npm pack mediabunny@1.59.0`，从发布包中提取生产文件与许可证
- 全局变量：该构建为经典脚本，加载后暴露全局 `Mediabunny`，无需打包、无需 Worker、无需 `fetch()` 加载额外二进制

## 许可证

- [Mozilla Public License 2.0](./mediabunny.LICENSE.txt)（MPL-2.0，文件级 copyleft）
- 项目整体为 MIT；MPL-2.0 允许在未修改依赖文件的前提下与 MIT 代码共同分发，本目录保留完整许可证与版权声明
- 上游版权：`Copyright (c) 2026-present, Vanilagy and contributors`

## 为什么选择它

- 原生 HTML5 + Vanilla JavaScript 项目，引入依赖需满足 `docs/TOOL_SPEC.md` §10：体积与功能相称、许可证兼容、固定版本、本地托管、不依赖 CDN
- Mediabunny 零依赖、纯 TypeScript 实现，单个生产文件约 668 KB，远小于 FFmpeg.wasm（约 30 MB）
- 经典脚本 + `Blob` 输入源，可在 `file://` 直接打开时使用，符合 §4「核心逻辑不得依赖 `fetch()`」

## 供应链与隐私评估

- 生产文件内不含 `eval`、`new Function`、远程 `fetch`、`XMLHttpRequest`、`WebSocket`、`importScripts` 或 `localStorage` 访问
- 不发起任何网络请求，不含追踪或遥测代码
- 仅在用户主动选择视频后读取该文件的字节，全部处理在本页内存中完成

## 替代方案

- FFmpeg.wasm：格式覆盖更广，但体积约 30 MB、需 `fetch` 加载 wasm 与 Worker、多线程需要 COOP/COEP 响应头（GitHub Pages 无法提供），与本项目规范冲突，未采用
- 自实现解封装/封装：成本与风险明显更高，且难以覆盖多种容器，未采用