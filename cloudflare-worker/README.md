# csgrad-positioning Worker

Cloudflare Worker，为 MSCS 选校定位 feature 提供付费后端（Stripe Checkout + KV 暂存）。

## 接口

- `POST /api/positioning/checkout` —— 接收 profile，创建 Stripe Checkout Session，返回 `{ checkoutUrl, sessionId }`
- `POST /api/stripe/webhook` —— Stripe 事件回调，验签后把订单标记 paid
- `GET /api/positioning/result?sessionId=xxx` —— 前端轮询结果

所有接口返回 `Access-Control-Allow-Origin: *`，支持 OPTIONS preflight。

## 部署步骤

1. 安装依赖：
   ```
   cd cloudflare-worker
   npm install
   ```

2. 创建 KV namespace 并把 id 填回 `wrangler.toml`：
   ```
   npx wrangler kv namespace create POSITIONING_KV
   ```
   把命令返回的 `id` 替换 `wrangler.toml` 中的 `TODO_FILL_AFTER_CREATE`。

3. 配置 Stripe secret（从 Stripe Dashboard 拿 `sk_test_xxx` / `sk_live_xxx`）：
   ```
   npx wrangler secret put STRIPE_SECRET_KEY
   ```

4. 暂时跳过 webhook secret（先 deploy 拿到 URL），或者已经知道就先放进去：
   ```
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

5. Deploy：
   ```
   npx wrangler deploy
   ```
   会得到形如 `https://csgrad-positioning.<acct>.workers.dev` 的 URL。

6. 在 Stripe Dashboard → Developers → Webhooks 添加 endpoint：
   - URL：`https://csgrad-positioning.<acct>.workers.dev/api/stripe/webhook`
   - 事件勾选：`checkout.session.completed`
   - 创建后把 Signing secret（`whsec_xxx`）放进 `STRIPE_WEBHOOK_SECRET` 然后再 `wrangler deploy` 一次。

7. 把 Worker URL 同步到前端 `src/lib/positioning/api.js` 的 `WORKER_BASE_URL`。

## 上线前 TODO

- `src/classifier.js` 和 `src/school-lists.json` 目前是 stub（tier 固定返回 `A`，school list 全空）。Agent 1 完成 `src/lib/positioning/classifier.js`、`src/lib/positioning/school-lists.json` 后，把 stub 改为 re-export / re-import 主仓文件：
  ```js
  export { classify, TIERS } from '../../src/lib/positioning/classifier.js';
  ```
  和
  ```js
  import schoolLists from '../../src/lib/positioning/school-lists.json';
  ```
  Wrangler 默认允许引主仓里的相对路径文件（确保打包时路径正确）。

## 本地调试

```
npx wrangler dev
```

用 Stripe CLI 把测试事件 forward 到本地：
```
stripe listen --forward-to localhost:8787/api/stripe/webhook
```

## 环境变量 / Secrets 清单

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `POSITIONING_KV` | KV binding | 暂存 submission，TTL 30 天 |
| `STRIPE_SECRET_KEY` | secret | Stripe API 调用 |
| `STRIPE_WEBHOOK_SECRET` | secret | webhook HMAC 校验 |
