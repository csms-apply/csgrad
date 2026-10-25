# 网站语言偏好与访问统计

网站沿用现有 GA4，不新建用户身份，也不采集姓名、邮箱、申请资料或表单文本。
语言偏好用于了解访问者选择的内容语言，不能据此推断国籍、族裔或申请背景。

## 语言偏好行为

用户点击语言选项时，即将该语言保存为默认语言。之后仅在访问未指定语言的根首页 `/` 时自动恢复偏好。
明确指定语言的 `/en/`、`/zh-Hant/`，以及其他深链接，不会因保存的偏好而被强制跳转。

## 事件

统一由 `src/lib/analytics/events.mjs` 的 `trackSeoEvent` 发送：

| 事件 | 含义 | 统计用途 |
| --- | --- | --- |
| `audience_visit` | 每次文档加载后的语言和偏好状态 | 按 `current_locale` 看实际阅读语言分布 |
| `language_preference_set` | 用户手动选择默认语言 | 按 `selected_locale` 看主动选择分布 |
| `language_preference_applied` | 已保存偏好自动跳转后，在目的页发送 | 观察默认语言功能的使用情况 |

`audience_visit` 每次文档加载只发送一次，同一文档内的 SPA 页面切换不重复发送；刷新或重新打开页面可再次发送。
不能把事件次数直接等同于独立访客人数。
`language_preference_applied` 通过 `sessionStorage` 将自动跳转信息传递给目的页；若该存储不可用，应用事件可能缺失，但语言恢复功能仍可正常工作。
比较访问者规模时使用 GA4 的用户指标；衡量操作次数时使用事件次数。

## 有限参数

| 参数 | 允许值 | 说明 |
| --- | --- | --- |
| `current_locale` | `zh-Hans` / `zh-Hant` / `en` | 必填，事件发生时的页面语言 |
| `preferred_locale` | 三种语言 / `none` | 必填，保存的偏好；没有时为 `none` |
| `preference_source` | `manual` / `saved` / `default` | 必填，手动选择 / 已保存偏好 / 未设置偏好 |
| `selected_locale` | 三种语言 | 仅 `language_preference_set` 必填 |
| `storage_status` | `persisted` / `unavailable` / `none` | 可选，已持久保存 / 存储不可用 / 尚无记录 |

必填参数缺失或非法时整条事件不发送。其他字段全部丢弃，包括旧漏斗事件所允许的自由文本字段。
这些事件使用 `transport_type: beacon`，尽量让切换页面前的选择事件完成发送；这不保证分析服务一定收到。
这些事件的 `page_location` 和 `page_path` 均固定为对应语言首页，`page_referrer` 为空，覆盖 Docusaurus/GA4 全局页面地址，避免继承查询参数、片段或个人路径。
这只约束新增语言事件，不改变现有 GA4 页面浏览和其他事件的采集规则。

## GA4 查看方法

在当前 GA4 资源中，为上述五个参数创建同名的**事件级自定义维度**。这需要 Editor 或更高权限；维度创建并开始收到事件后，报表通常需要 24–48 小时才能使用这些数据。参见 [Google 官方说明](https://support.google.com/analytics/answer/14239696)。

推荐建立三个探索报表：

1. 过滤 `event_name = audience_visit`，行选 `current_locale`，值选总用户数和事件数；用 `preferred_locale` 区分保存了偏好的访问者。
2. 过滤 `event_name = language_preference_set`，行选 `selected_locale`，值选事件数；用 `storage_status` 检查偏好是否成功保存。
3. 过滤 `event_name = language_preference_applied`，行选 `preferred_locale`，值选事件数，观察回访时自动应用语言的情况。

这份代码改动不会自动创建 GA4 后台自定义维度。广告拦截、未加载分析脚本等情况可能导致少计；语言切换本身不依赖统计服务是否可用。

## 本地验证

运行 `npm run test:analytics`。测试验证三种语言、缺失/非法参数拒绝、自由文本与 URL 信息不会进入新增事件，并保留原有购买统计测试。
