# OpenEduTools 工具开发规范

版本：0.1
状态：V0.1 基线规范

本规范定义 OpenEduTools 单个工具的目录、元数据、技术边界、界面、隐私、无障碍、测试和验收要求。规范中的“必须”“不得”为合并要求；“建议”为默认最佳实践，如偏离应在 PR 中说明。

## 1. 工具定义

一个 OpenEduTools 工具应：

- 解决一个清晰、具体、可描述的任务；
- 不依赖登录、付费账户或自建后端；
- 默认在浏览器本地处理数据；
- 可以独立打开并完成核心流程；
- 复用站点的视觉与交互规范；
- 对非技术用户提供明确输入、操作、结果和错误提示。

不适合作为单个工具的内容包括：大型课程管理系统、社交平台、需要长期服务器状态的协作应用，以及只包装第三方网站的链接页。

## 2. 目录与文件

每个工具必须放在独立目录：

```text
tools/<tool-id>/
├── index.html       # 必需：入口页面
├── style.css        # 必需：工具专属样式，可为空但应保留
├── script.js        # 必需：工具逻辑
└── tool.json        # 必需：元数据
```

可选内容：

```text
tools/<tool-id>/
├── assets/          # 仅该工具使用的图片或字体
├── vendor/          # 经批准并本地托管的第三方依赖
└── README.md        # 复杂算法、数据格式或来源说明
```

规则：

- `<tool-id>` 必须与 `tool.json.id` 完全一致；
- 仅使用小写英文字母、数字和连字符，格式为 kebab-case；
- ID 发布后视为稳定 URL，除非提供兼容跳转，否则不得随意修改；
- 文件名区分大小写，必须在 Linux 环境下可用；
- 不提交构建产物、编辑器缓存或个人配置。

## 3. `tool.json` 元数据

### 3.1 完整示例

```json
{
  "$schema": "../../schemas/tool.schema.json",
  "id": "random-group",
  "name": "随机分组",
  "description": "将名单随机分成指定组数或每组指定人数。",
  "category": "classroom-management",
  "subjects": ["general"],
  "tags": ["分组", "随机", "名单", "课堂"],
  "version": "0.1.0",
  "status": "stable",
  "entry": "tools/random-group/index.html",
  "icon": "users-round",
  "offline": true,
  "dataPolicy": "local-only",
  "featured": true,
  "createdAt": "2026-09-20",
  "updatedAt": "2026-09-20"
}
```

### 3.2 字段定义

| 字段 | 类型 | 必需 | 规则 |
| --- | --- | --- | --- |
| `$schema` | string | 建议 | 固定为 `../../schemas/tool.schema.json` |
| `id` | string | 是 | 2–50 字符，kebab-case，与目录名一致，全局唯一 |
| `name` | string | 是 | 面向用户的中文名称，2–20 个字符，避免“万能”“最好”等宣传词 |
| `description` | string | 是 | 一句话说明输入、动作或结果，建议 15–60 个中文字符 |
| `category` | string | 是 | 必须取自稳定分类 ID |
| `subjects` | string[] | 是 | 1–4 个学科 ID；跨学科工具使用 `general` |
| `tags` | string[] | 是 | 2–8 个可搜索词；去重，不使用 `#` |
| `version` | string | 是 | 语义化版本 `MAJOR.MINOR.PATCH` |
| `status` | string | 是 | `experimental`、`beta`、`stable` 或 `deprecated` |
| `entry` | string | 是 | 从仓库根目录开始的相对路径，必须指向工具入口 |
| `icon` | string | 是 | 允许的图标注册名，不存放 emoji 或远程 URL |
| `offline` | boolean | 是 | 核心流程是否不访问网络；V0.1 必须为 `true` |
| `dataPolicy` | string | 是 | V0.1 必须为 `local-only` |
| `featured` | boolean | 是 | 是否进入首页精选；由维护者决定 |
| `createdAt` | string | 是 | 首次加入日期，格式 `YYYY-MM-DD` |
| `updatedAt` | string | 是 | 用户可见功能最后更新日期，格式 `YYYY-MM-DD` |

V0.1 分类 ID：

```text
lesson-planning
classroom-management
assessment
research
data-processing
text-processing
ai-assistance
general
```

学科 ID：

```text
general
language
mathematics
science
humanities
arts
physical-education
information-technology
```

### 3.3 单一来源

- 每个 `tool.json` 是该工具元数据的唯一来源。
- `data/tools.json` 必须由脚本生成，不手工维护重复内容。
- 生成结果按 `name` 或项目约定的稳定键排序，确保差异可审查。
- 元数据校验失败时，持续集成必须失败。

## 4. HTML 结构

工具入口必须：

- 声明 `<!doctype html>`、`lang="zh-CN"`、UTF-8 和 viewport；
- 使用语义化结构，并且每页只有一个主要 `h1`；
- 提供“返回全部工具”的可识别链接；
- 加载公共样式和本工具样式；
- 使用相对路径，兼容仓库子路径部署；
- 不依赖服务端模板或 URL 重写；
- 提供简短用途说明与本地处理提示；
- 为结果区域设置适当标题，动态结果必要时使用 `aria-live="polite"`；
- 在禁用 JavaScript 时给出说明。

推荐骨架：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="将名单随机分成若干组。">
    <title>随机分组 · OpenEduTools</title>
    <link rel="stylesheet" href="../../css/tokens.css">
    <link rel="stylesheet" href="../../css/main.css">
    <link rel="stylesheet" href="../../css/tool.css">
    <link rel="stylesheet" href="./style.css">
    <script src="../../js/tool-page.js" defer></script>
    <script src="./script.js" defer></script>
  </head>
  <body>
    <a class="skip-link" href="#main">跳到主要内容</a>
    <header class="site-header">...</header>
    <main id="main" class="tool-layout">
      <nav aria-label="面包屑">...</nav>
      <header class="tool-header">...</header>
      <section class="tool-panel" aria-labelledby="input-title">...</section>
      <section class="tool-result" aria-labelledby="result-title" aria-live="polite">...</section>
    </main>
    <noscript>此工具需要启用 JavaScript 才能运行。</noscript>
  </body>
</html>
```

直接通过 `file://` 打开时，共享资源路径必须仍能解析。工具的核心逻辑不得依赖 `fetch()`；如果需加载示例数据，应内嵌最小示例或由用户主动选择本地文件。

## 5. 统一 UI 与交互

### 5.1 页面组成

每个工具页应具有一致的顺序：

1. 返回导航或面包屑；
2. 工具名称、简短说明和隐私状态；
3. 输入区域；
4. 主操作与次操作；
5. 结果区域；
6. 使用提示、限制或数据说明。

### 5.2 设计变量

颜色、字体、字号、间距、圆角、边框、阴影和层级必须优先使用 `css/tokens.css` 的自定义属性。工具不得创建与公共设计体系冲突的主题。

### 5.3 控件与反馈

- 每个操作使用明确动词，如“开始分组”“复制结果”“重置”。
- 主操作每个视图原则上只有一个。
- 危险或清空操作必须与主操作在视觉上区分；不可恢复时需要确认或撤销路径。
- 复制、下载、导入、失败和空结果都要有可见反馈。
- 长任务应显示处理状态，并避免重复触发。
- 不用浏览器 `alert()` 作为常规结果界面。
- 结果应尽量可复制、可下载或可打印；导出文件名要有意义。

### 5.4 状态

每个工具都应设计以下状态：初始、可操作、处理中（如适用）、成功、空结果、输入错误、运行失败、重置后。

## 6. JavaScript 设计

建议按以下职责组织：

```text
parseInput(raw)       -> 结构化输入或可解释错误
validateInput(data)   -> 校验结果
runTool(data, options)-> 纯计算结果
renderResult(result)  -> DOM 更新
exportResult(result)  -> 可选导出
resetTool()           -> 重置当前工具状态
```

要求：

- 核心算法尽量写成无 DOM 依赖的纯函数；
- 随机工具优先使用 `crypto.getRandomValues()`，不可用时可有明确的兼容回退；
- 不假装随机结果具有密码学、公平抽签或法律意义；
- 解析 CSV 等格式时需处理引号、换行和编码，不能只用简单 `split(',')` 冒充完整解析；
- 大输入应设置合理软限制、进度或提示，避免冻结页面；
- 文件操作只读取用户主动选择的文件；
- 对浏览器 API 做特性检测并提供降级路径。

## 7. 本地状态

允许保存非敏感偏好和用户明确要求保留的数据：

```text
openEduTools:favorites
openEduTools:recent
openEduTools:theme
openEduTools:tool:<tool-id>:settings
```

规则：

- 默认不持久保存名单、成绩、作业内容等敏感输入；
- 如工具提供“记住输入”，必须默认关闭、明确说明保存位置，并提供清除按钮；
- 读取本地存储时处理无权限、配额不足、JSON 损坏和旧版本数据；
- 单个工具不得清空整个域名下的 `localStorage`；
- `recent` 只记录工具 ID 和访问时间，不记录用户输入。

## 8. 搜索、分类、收藏与最近使用

首页目录行为：

- 搜索范围至少包括 `name`、`description`、`tags`、功能分类和学科分类，并容忍少量错字或不连续关键词；
- 搜索对大小写不敏感，并对首尾空格做归一化；
- 分类筛选和搜索可以组合；
- 无结果时提供清除条件的操作；
- 收藏按工具 ID 保存，重复操作具有幂等性；
- 最近使用按工具 ID 去重，以最新访问时间排序，V0.1 最多保留 10 条；
- 已删除或未知工具 ID 必须被安全忽略；
- 隐私模式或存储不可用时，核心浏览与工具功能仍可使用。

### 8.1 单工具离线包

- `tool.json` 仍是唯一元数据源，离线 ZIP 由 `npm run build:downloads` 统一生成，不手工编辑；
- 压缩包保留工具页所依赖的 `tools/`、`css/`、`js/` 和图标相对目录；
- 教师解压完整目录后可直接双击根目录 `index.html` 进入工具；
- 离线包不得新增联网依赖、真实数据或与源码不同步的实现；
- `npm run check:downloads` 必须能发现缺失或过期的压缩包。

## 9. 隐私、安全与网络

V0.1 工具必须满足：

- `offline: true` 且 `dataPolicy: "local-only"`；
- 不发送名单、成绩、文本、文件名、文件内容或操作记录；
- 不加载分析、广告、第三方追踪或远程字体；
- 不把用户输入拼接为 HTML、CSS、脚本、URL 或选择器执行；
- 不使用动态代码执行；
- 不含密钥、令牌、内部服务地址或真实个人数据；
- 下载内容使用安全 MIME 类型和净化后的文件名；
- 打开的外部链接使用恰当的 `rel="noopener noreferrer"`。

如果未来引入联网工具，必须先更新本规范，增加显式同意、数据流说明、故障处理和第三方隐私评估。仅修改 `tool.json` 不足以绕过 V0.1 限制。

## 10. 第三方依赖

默认不添加依赖。确有必要时，PR 必须同时满足：

- 原生实现成本或风险明显更高；
- 依赖体积与功能相称，维护活跃；
- 许可证与项目兼容；
- 固定明确版本并将生产文件托管在仓库内；
- 保留许可证与来源说明；
- 不从 CDN 运行，不包含追踪或远程请求；
- 有输入安全和供应链风险说明；
- 经维护者在 Issue 中同意。

不得直接提交完整包管理缓存或未经审查的压缩产物。

## 11. 无障碍

最低要求：

- 完整键盘操作，无键盘陷阱；
- 焦点顺序符合视觉顺序，焦点样式清晰；
- 表单控件有可见标签，错误与对应控件关联；
- 标题层级合理；
- 文本和关键控件达到 WCAG AA 对比度目标；
- 触控目标建议不小于 44×44 CSS 像素；
- 动画尊重 `prefers-reduced-motion`；
- 动态结果和状态可被辅助技术获知；
- 图标按钮具有可访问名称；
- 不只依靠颜色、位置或动画表达含义。

## 12. 响应式与兼容性

- 在约 360px 宽度下不得产生页面级水平滚动；
- 在 200% 浏览器缩放下核心流程仍可完成；
- 桌面端内容区应控制可读行宽；
- 表格在小屏应支持滚动、转卡片或提供摘要；
- 支持最近两个主要版本的 Chrome、Edge、Firefox 和 Safari；
- GitHub Pages 项目站点部署时所有资源和链接可用。

## 13. 性能

V0.1 目标：

- 首页和单工具页不引入大型框架；
- 非必要资源延迟加载；
- 图片设置尺寸并使用适合格式；
- 工具的输入事件避免无节制高频计算；
- 常见输入规模下操作应即时或给出进度反馈；
- 不以牺牲正确性、无障碍或可维护性换取微小性能数字。

## 14. 测试与验收

每个新工具的 PR 必须提供手工测试记录；核心算法应尽可能有自动化单元测试。

### 功能验收

- [ ] 典型输入产生正确、可理解的结果；
- [ ] 空输入和错误输入不会崩溃；
- [ ] 边界输入得到限制、提示或正确结果；
- [ ] 重置恢复到清晰初始状态；
- [ ] 复制、下载、导入等附加操作有成功与失败反馈；
- [ ] 刷新或重复操作不会出现陈旧状态。

### 集成验收

- [ ] 目录名、入口与 `tool.json` 一致；
- [ ] 元数据校验通过，`data/tools.json` 已同步；
- [ ] 首页搜索、分类、收藏和最近使用可发现该工具；
- [ ] 相对路径和 GitHub Pages 子路径可用；
- [ ] 直接打开工具入口时核心流程可用。

### 质量验收

- [ ] 没有意外网络请求；
- [ ] 没有控制台错误；
- [ ] 键盘、窄屏、缩放和至少两种浏览器已测试；
- [ ] 用户输入不会被解释为可执行内容；
- [ ] 文案面向教师，避免不必要的技术术语；
- [ ] 示例数据为虚构且不包含个人信息。

## 15. 完成定义

一个工具只有在以下条件全部满足时才算完成：

1. 核心用例可稳定完成；
2. 文件与元数据符合规范；
3. 已接入目录、搜索、分类、收藏和最近使用；
4. 隐私、安全、无障碍、响应式和兼容性检查通过；
5. 文档与测试已更新；
6. PR 描述足以让评审者复现验证；
7. 不存在阻断发布的已知问题。
