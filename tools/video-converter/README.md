# 视频格式转换

在浏览器本地转换视频容器与编码，视频文件不上传。

## 能力

- 输入容器：MP4、MOV/M4V、WebM、MKV、MPEG-TS 等浏览器可解封装的格式
- 输出容器：MP4（H.264 + AAC，兼容性最好）、WebM（VP9 + Opus，网页友好）
- 编码已与目标一致时可只换封装（无损、快速），否则自动转码
- 质量预设：保持画质、均衡、优先体积、仅换封装
- 高级选项：限制分辨率、指定帧率、去除声音

## 不支持

- AVI、WMV、FLV、RMVB 等老容器：浏览器没有对应的解封装能力，只有 FFmpeg 一类方案可处理
- DRM 加密视频
- HEVC/H.265 等编码是否可用取决于系统与浏览器是否提供解码器
- 目标编码是否可用取决于浏览器是否提供编码器（工具会在选择文件后检测并提示）

## 依赖

- [Mediabunny](https://mediabunny.dev/) 1.59.0（MPL-2.0），详见 `vendor/README.md`
- 全部处理在本页内存中完成，不使用网络请求、不写入本地存储

## 实现要点

- `script.js` 中的纯函数（`planConversion`、`estimateBitrate`、`resolveDimension`、`sanitizeOutputName`、`formatBytes` 等）无 DOM 依赖，通过 `module.exports` 导出并由 `tests/video-converter.test.js` 覆盖
- 主线程使用 Mediabunny 的 `Conversion` 流式处理，通过 `onProgress` 回报进度；不使用 Worker，以保证 `file://` 直接打开时可用
- 编码能力通过 `VideoEncoder`/`AudioEncoder`（WebCodecs）检测，不满足时给出中文提示而不是直接失败

## 已知限制

- 输出先在内存中汇总再生成下载文件，超大文件（超过约 1 GB）可能受浏览器内存限制
- 转码速度取决于浏览器与硬件加速，软编码场景可能慢于实时