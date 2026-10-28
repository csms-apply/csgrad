// csgrad 表单系统：前端共享的题型定义、条件显示和接口调用。
// 后端在 csgrad-backend/cloudflare-worker/src/forms.js 有同一份规则的校验，改题型时两边一起改。
//
// 表单结构：
//   { id, title, description, status: 'open'|'closed', requireLogin, fields: Field[], createdAt, updatedAt }
// Field：
//   { id, type, label, help?, required?, options?: string[], showIf?: { field, equals } }
// 回答：answers = { [fieldId]: string | string[] }（multi 为数组，其余为字符串）

import { SITE_API_BASE } from '@site/src/lib/positioning/api';

export const FIELD_TYPES = [
  { type: 'short', label: '简答' },
  { type: 'paragraph', label: '段落' },
  { type: 'email', label: '邮箱' },
  { type: 'url', label: '链接' },
  { type: 'number', label: '数字' },
  { type: 'date', label: '日期' },
  { type: 'single', label: '单选', hasOptions: true },
  { type: 'multi', label: '多选', hasOptions: true },
  { type: 'dropdown', label: '下拉', hasOptions: true },
  { type: 'section', label: '分节标题' }, // 只展示标题和说明，不收集回答
];

export const OPTION_TYPES = FIELD_TYPES.filter((t) => t.hasOptions).map((t) => t.type);

export const FORM_ID_RE = /^[a-z0-9][a-z0-9-]{2,59}$/;

export function newField(type = 'short') {
  return {
    id: `f_${Math.random().toString(36).slice(2, 10)}`,
    type,
    label: '',
    required: false,
    ...(OPTION_TYPES.includes(type) ? { options: ['选项 1'] } : {}),
  };
}

// showIf 指向的题目答案等于 equals（多选题则包含 equals）时才显示。
export function isVisible(field, answers) {
  if (!field.showIf || !field.showIf.field) return true;
  const v = answers[field.showIf.field];
  return Array.isArray(v) ? v.includes(field.showIf.equals) : v === field.showIf.equals;
}

export function formLink(id) {
  return `${typeof window !== 'undefined' ? window.location.origin : 'https://csgrad.com'}/f?id=${id}`;
}

async function call(path, { token, method = 'GET', body } = {}) {
  const r = await fetch(`${SITE_API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(json.error || `HTTP ${r.status}`);
    err.status = r.status;
    err.field = json.field;
    throw err;
  }
  return json;
}

// ---- 公开 ----
export const getPublicForm = (id) => call(`/api/forms/${id}`);
export const submitResponse = (id, answers, website = '') =>
  call(`/api/forms/${id}/responses`, { method: 'POST', body: { answers, website } });

// ---- 管理（Bearer 令牌，与直播报名后台共用 LIVE_ADMIN_TOKEN）----
export const ADMIN_TOKEN_KEY = 'csgrad.liveAdminToken';
export const listForms = (token) => call('/api/admin/forms', { token });
export const createForm = (token, form) => call('/api/admin/forms', { token, method: 'POST', body: form });
export const updateForm = (token, form) => call(`/api/admin/forms/${form.id}`, { token, method: 'PUT', body: form });
export const deleteForm = (token, id) => call(`/api/admin/forms/${id}`, { token, method: 'DELETE' });
export const listResponses = (token, id) => call(`/api/admin/forms/${id}/responses`, { token });
