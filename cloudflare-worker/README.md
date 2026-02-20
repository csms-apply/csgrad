# csgrad Report API — Cloudflare Worker

## Setup

1. Install wrangler: `npm install`
2. Login: `npx wrangler login`
3. Create KV namespace:
   ```bash
   npx wrangler kv:namespace create "REDEMPTION_CODES"
   ```
   Copy the output id into `wrangler.toml`.

4. Set secrets:
   ```bash
   npx wrangler secret put SEATABLE_API_TOKEN
   npx wrangler secret put SEATABLE_BASE_UUID
   npx wrangler secret put HMAC_SECRET
   ```

5. Add redemption codes to KV:
   ```bash
   npx wrangler kv:key put --namespace-id=YOUR_ID "CODE123" '{"usesLeft":10}'
   ```

## Development

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

## API

### POST /api/validate-code
```json
{ "code": "ABCDEF" }
```
Returns: `{ "token": "jwt...", "expiresIn": 86400 }`

### POST /api/generate-report
Header: `Authorization: Bearer <jwt>`
```json
{
  "gpa": 3.7,
  "gpaScale": "4.0",
  "gre": 325,
  "schoolTier": "985",
  "major": "CS",
  "internships": "2",
  "research": true
}
```
Returns classified programs with Reach/Target/Safety grouping.

## Important

The SeaTable table/column names in `src/seatable.js` are **placeholders**.
Update them to match the actual SeaTable schema before deployment.
