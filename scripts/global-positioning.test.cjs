const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformFileSync } = require('@babel/core');
function load(file) {
  const filename = path.join(__dirname, '..', file);
  const { code } = transformFileSync(filename, { babelrc: false, configFile: false,
    presets: [require.resolve('@babel/preset-react')], plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')] });
  const out = {};
  vm.runInNewContext(code, { exports: out, require(name) {
    if (name === 'react') return React;
    if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, k) => k }) };
    if (name.includes('profile-schema')) return schema;
    if (name.startsWith('@')) return {};
    throw Error(name);
  } });
  return out;
}
const schema = load('src/lib/positioning/profile-schema.js');
const form = load('src/pages/school-positioning.jsx');
const result = load('src/pages/school-positioning-result.jsx');
const fields = schema.FIELD_DEFINITIONS;
const json = value => JSON.parse(JSON.stringify(value));
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const validationCopy = { fillRequired: 'Required', errInvalidNumber: 'Invalid', errRange: '{min}–{max}', errInteger: 'Integer' };

test('global mode is default, asks actual standing, and retains legacy Chinese routes', () => {
  const profile = form.buildInitialProfile(fields);
  assert.equal(profile.ugType, 'global'); assert.equal(profile.educationSystem, '');
  assert.equal(profile.academicStanding, 'unknown');
  assert.ok(fields.find(f => f.key === 'ugType').options.some(o => o.value === 'cn-985'));
  assert.ok(fields.find(f => f.key === 'educationSystem').options.some(o => o.value === 'india'));
  assert.ok(!JSON.stringify(fields.find(f => f.key === 'ugType').options).includes('IIT'));
});
test('original Indian, UK and German grades remain unconverted and bounds respect direction', () => {
  const gpaField = fields.find(f => f.key === 'gpa');
  for (const [educationSystem, gpaScale, gpa, min, max] of [
    ['india', '10.0', '8.5', 0, 10], ['uk', 'uk-100', '68', 0, 100], ['germany', 'german-5', '1.7', 1, 5],
  ]) {
    const profile = { ...form.buildInitialProfile(fields), educationSystem, gpaScale, gpa };
    assert.deepEqual(json(form.getGpaBoundsByScale(gpaScale)), { min, max });
    const payload = form.coerceProfile(profile, fields);
    assert.equal(payload.gpa, Number(gpa)); assert.equal(payload.gpaScale, gpaScale);
    assert.equal(form.validateOne(gpaField, gpa, profile, validationCopy), null);
    assert.ok(form.validateOne(gpaField, max + 1, profile, validationCopy));
  }
  assert.ok(form.validateOne(gpaField, 0, { gpaScale: 'german-5' }, validationCopy));
});
test('legacy profiles do not accidentally submit global hidden fields or new scales', () => {
  const profile = { ...form.buildInitialProfile(fields), ugType: 'cn-985', educationSystem: 'india', academicStanding: 'top-10', gpaScale: '10.0' };
  const payload = form.coerceProfile(profile, fields);
  assert.equal(payload.educationSystem, undefined); assert.equal(payload.academicStanding, undefined);
  assert.equal(form.validateOne(fields.find(f => f.key === 'gpaScale'), '10.0', profile, validationCopy), 'Required');
});
test('unknown review, missing preview and backend field errors cannot enable checkout', () => {
  assert.equal(form.canCheckout(null, false), false);
  assert.equal(form.canCheckout({ tier: 'A', needsReview: true }, false), false);
  assert.equal(form.canCheckout({ tier: 'A', errors: [{ field: 'gpa' }] }, false), false);
  assert.equal(form.canCheckout({ tier: 'A', fieldErrors: { gpa: 'invalid' } }, false), false);
  assert.equal(form.canCheckout({ tier: 'A' }, true), false);
  assert.equal(form.canCheckout({ tier: 'A', needsReview: false }, false), true);
});
test('backend errors show bilingual field messages instead of a raw JSON response', async () => {
  const errors = [{ field: 'academicStanding', code: 'review', message: { en: 'Provide an actual ranking', 'zh-Hans': '请填写实际排名' } }];
  assert.deepEqual(json(form.localizedFieldErrors(errors, 'en')), { academicStanding: 'Provide an actual ranking' });
  assert.deepEqual(json(form.localizedFieldErrors({ gpa: ['Invalid grade'] }, 'en')), { gpa: 'Invalid grade' });
  await assert.rejects(form.readPositioningResponse({ ok: false, text: async () => JSON.stringify({ message: { en: 'Review needed' }, errors }) }, 'en'), e => e.message === 'Review needed' && e.fieldErrors[0].field === 'academicStanding');
});
test('English fit details and report checklist render without Chinese text and remain safe', () => {
  const html = render(result.ProgramFit, { locale: 'en', fit: { trackMatch: 'adjacent',
    reasons: [{ en: 'Related systems coursework', 'zh-Hans': '相关系统课程' }],
    checks: [{ code: 'prereqs', status: 'verify', message: { en: 'Verify course credits <script>', 'zh-Hans': '核验学分' } }] } });
  assert.match(html, /Related track/); assert.match(html, /Verify course credits/);
  assert.ok(!html.includes('相关系统课程')); assert.ok(!html.includes('<script>'));
  const checklist = render(result.ReportChecklist, { locale: 'en', items: [{ code: 'grades', priority: 'high', message: { en: 'Confirm grading scale', 'zh-Hans': '确认分制' } }] });
  assert.match(checklist, /Check first/); assert.match(checklist, /Confirm grading scale/);
  assert.equal(render(result.ProgramFit, { locale: 'en' }), '');
  assert.equal(render(result.ReportChecklist, { locale: 'en' }), '');
});
test('preview and checkout payloads carry explicit report locale with unchanged original grades', () => {
  const profile = { ...form.buildInitialProfile(fields), educationSystem: 'germany', gpaScale: 'german-5', gpa: '1.3', academicStanding: 'unknown' };
  const payload = form.positioningPayload(profile, fields, 'en');
  assert.equal(payload.locale, 'en'); assert.equal(payload.gpa, 1.3);
  assert.equal(payload.gpaScale, 'german-5'); assert.equal(payload.academicStanding, 'unknown');
});
