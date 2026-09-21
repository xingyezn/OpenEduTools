# AGENTS.md

本文件记录在本仓库工作时的约定与常用命令，供自动化助手参考。

## 工作方式

- 完成用户要求的改动后，**直接提交并推送到 GitHub，无需再询问**（用户已明确本项目都这样操作）。
- 提交信息使用英文、`type: summary` 形式（如 `feat:`、`fix:`、`docs:`、`chore:`），与现有提交保持一致。
- 只提交与本次任务相关的文件；不要提交密钥、真实数据或无关改动。

## 常用命令

```bash
npm run check            # 元数据 + 索引 + 离线包 + 测试 + 路径 + 隐私（提交前必跑）
node scripts/build-tools-index.mjs   # 重新生成 data/tools.json（改 tool.json 后）
npm run build:downloads  # 重新生成 downloads/*.zip（改工具或共享资源后）
npm run smoke:chrome     # 需要先起静态服务器，如 python -m http.server 8765
npm run smoke:edge
```

## 工具开发约定

- 每个工具放在 `tools/<tool-id>/`，包含 `index.html`、`style.css`、`script.js`、`tool.json`。
- `tool.json` 是元数据唯一来源；改后运行 `build:tools-index`，并确保 `npm run check` 通过。
- 新增图标需同时更新三处：`schemas/tool.schema.json`、`scripts/tool-metadata.mjs`、`js/catalog.js`。
- 工具页脚本顺序：`theme.js`、`storage.js`、`favorites.js`、`recent.js`、`analytics.js`、`format.js`、`tool-page.js`、`./script.js`。
- 核心算法写成无 DOM 依赖的纯函数，通过 `module.exports` 导出，并在 `tests/` 添加测试。
- 统计：核心功能成功后调用 `root.OpenEduAnalytics?.toolUse?.('<tool-id>')`。
- 隐私：`offline: true`、`dataPolicy: "local-only"`；不联网、不引入远程资源、不使用 `eval`；`localStorage` 键必须以 `openEduTools:` 开头。
- 改共享资源（`css/*`、`js/*`、图标、logo）后必须重新生成离线包，否则 `check:downloads` 会失败。
