# V0.1 发布与人工验收清单

自动化检查使用 `npm run check`。以下项目必须在正式发布前由维护者补充真实记录，不得用自动化结果替代。

## 手工可用性

- [ ] 首页与 9 个工具仅用键盘完成核心流程，无键盘陷阱；
- [ ] 约 360px、768px、桌面宽度和 200% 缩放下无阻断流程或页面级横向滚动；
- [ ] 开启减少动画偏好后无闪烁或强制动画；
- [ ] 动态状态、错误和结果可被辅助技术感知；
- [ ] Chrome/Edge 最新稳定版通过；
- [ ] Firefox 或 Safari 最新稳定版通过；
- [ ] 至少一种移动端浏览器或真机通过；
- [ ] 至少两名测试者可在无口头指导下完成主要用例。

## 隐私与发布

- [ ] 浏览器网络面板确认除首次加载本站静态资源和匿名统计事件外无请求；匿名统计只发送 `tool_id` 与事件类型；
- [ ] 断网或 Cloudflare 服务不可用时，工具核心流程仍可用；
- [ ] localStorage 只含 `openEduTools:theme`、`openEduTools:favorites`、`openEduTools:recent`（以及各工具 `openEduTools:tool:<id>:settings`）；`tool_open` 去重时间戳只写入 `sessionStorage`；
- [ ] 仓库 Settings → Secrets and variables → Actions 已配置 `STATS_API_URL` 与 `STATS_API_TOKEN`，且未写入代码或日志；
- [ ] `data/stats.json` 不包含任何用户信息；
- [ ] GitHub Pages 线上首页、公共页面和 9 个工具冒烟通过；
- [ ] 仓库 Settings → Pages 的 Source 已选择 GitHub Actions；
- [ ] 默认分支 CI 与 Pages 工作流连续成功；
- [ ] 创建 `v0.1.0` 标签与 Release，并使用 `CHANGELOG.md` 作为说明；
- [ ] 如发布失败，回滚到上一个成功 Pages artifact 或回退造成失败的提交。

## 当前已知限制

- 首页通过 `fetch()` 读取生成索引，直接用 `file://` 打开时部分浏览器会阻止读取；页面会给出静态服务器提示，单个工具仍可直接打开。
- 复制功能依赖安全上下文中的 Clipboard API；不可用时会提示手动复制。
- 全屏和提示音受浏览器能力与用户权限限制；不影响计时。
