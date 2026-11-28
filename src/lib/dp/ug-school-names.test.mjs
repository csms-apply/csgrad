import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UG_SCHOOL_NAMES, displayUgSchool, isKnownUgSchool, normalizeUgSchool, searchUgSchools, ugSchoolLabelsFor,
} from './ug-school-names.mjs';

test('undergraduate school list: search, aliases and display names', () => {
  assert.equal(new Set(UG_SCHOOL_NAMES).size, UG_SCHOOL_NAMES.length);
  assert.equal(searchUgSchools('山东')[0], '山东大学');
  assert.ok(searchUgSchools('shandong').includes('山东大学'));
  assert.equal(searchUgSchools('ucsd')[0], 'UC San Diego');
  assert.deepEqual(searchUgSchools('no such school'), []);
  assert.equal(normalizeUgSchool(' 大连理工 '), '大连理工大学');
  assert.equal(normalizeUgSchool('CUHK'), '香港中文大学');
  assert.equal(normalizeUgSchool('ucla'), 'UCLA');
  assert.equal(normalizeUgSchool('某某学院'), '某某学院');
  assert.ok(isKnownUgSchool('台湾大学') && !isKnownUgSchool('某某学院'));
  assert.equal(displayUgSchool('中山大学', ugSchoolLabelsFor('en')), 'Sun Yat-sen University');
  assert.equal(displayUgSchool('中山大学', ugSchoolLabelsFor('zh-Hans')), '中山大学');
});
