# 改动到上线的流程

CI（`.github/workflows/deploy.yml`）在 PR 和 main 上都会跑完整构建和全部测试，main 通过后自动部署到 VPS。本地不要再全量跑 `npm run build` 和各个 `test:*`。

1. 从最新的 `origin/main` 开新分支。
2. 本地只做 CI 做不到的事：
   - 改了 `docs/`、导航 / 页脚名称或 `translate()` 文案：跑 `npm run generate:traditional`，生成的繁体文件一起提交（CI 只检查，不生成）。
   - 改了页面或交互：本地起站点，在浏览器里看一眼。
   - 改了带单测的模块：只跑那一个测试文件。
3. 开 PR 后执行 `gh pr merge <PR号> --auto --merge`，CI 通过就自动合并。
4. 只有整页重写、部署脚本、数据结构这类大改动，才另起 agent 审查。
5. 合并后更新本地 main；页面改动上线后用 curl 确认一下。
