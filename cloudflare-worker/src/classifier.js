/**
 * Reach / Target / Safety classifier.
 *
 * Groups datapoints by program, computes admission rates,
 * and classifies each program.
 */

import {
  COL_DP_APPLICANT,
  COL_DP_PROGRAM,
  COL_DP_RESULT,
  COL_DP_SCHOLARSHIP,
  getLinkDisplayValue,
  getLinkRowId,
  parseSchoolFromProgram,
} from './seatable.js';

// Admission result values (from SeaTable single-select options)
const POSITIVE_RESULTS = ['Admit'];

/**
 * Classify programs into Reach / Target / Safety / Insufficient.
 *
 * @param {Array} datapoints - Admission result records from SeaTable
 * @param {Array} anonymizedApplicants - Anonymized applicant data
 * @returns {Object} Classified programs grouped by category
 */
export function classifyPrograms(datapoints, anonymizedApplicants) {
  // Build applicant lookup by row_id
  const applicantMap = {};
  for (const a of anonymizedApplicants) {
    applicantMap[a.id] = a;
  }

  // Group datapoints by program
  const programMap = {};

  for (const dp of datapoints) {
    // Extract values from link columns
    const programFull = getLinkDisplayValue(dp[COL_DP_PROGRAM]);
    const applicantRowId = getLinkRowId(dp[COL_DP_APPLICANT]);
    const school = parseSchoolFromProgram(programFull);
    const result = dp[COL_DP_RESULT] || '';

    if (!programFull) continue; // skip if no program

    const key = programFull;

    if (!programMap[key]) {
      programMap[key] = {
        school,
        program: programFull,
        datapoints: [],
      };
    }

    const isAdmitted = POSITIVE_RESULTS.some(
      (r) => result.toLowerCase() === r.toLowerCase()
    );

    programMap[key].datapoints.push({
      result,
      admitted: isAdmitted,
      scholarship: !!dp[COL_DP_SCHOLARSHIP],
      applicantLabel: applicantMap[applicantRowId]?.label || 'Unknown',
      applicantGpa: applicantMap[applicantRowId]?.gpa,
      applicantSchoolTier: applicantMap[applicantRowId]?.schoolTier,
    });
  }

  // Classify each program
  const results = {
    safety: [],
    target: [],
    reach: [],
    stats: { totalPrograms: 0, totalDatapoints: 0, totalApplicants: anonymizedApplicants.length },
  };

  for (const [, prog] of Object.entries(programMap)) {
    const total = prog.datapoints.length;
    const admitted = prog.datapoints.filter((d) => d.admitted).length;

    // Skip programs with < 3 datapoints or 0% admission rate
    if (total < 3 || admitted === 0) continue;

    results.stats.totalDatapoints += total;

    const rate = admitted / total;
    const entry = {
      school: prog.school,
      program: prog.program,
      totalApplicants: total,
      admittedCount: admitted,
      admissionRate: Math.round(rate * 100),
    };

    if (rate >= 0.7) {
      entry.category = 'safety';
      entry.datapoints = prog.datapoints;
      results.safety.push(entry);
    } else if (rate >= 0.3) {
      entry.category = 'target';
      entry.datapoints = prog.datapoints;
      results.target.push(entry);
    } else {
      entry.category = 'reach';
      entry.datapoints = prog.datapoints;
      results.reach.push(entry);
    }
  }

  // Sort each category by admission rate descending
  results.safety.sort((a, b) => b.admissionRate - a.admissionRate);
  results.target.sort((a, b) => b.admissionRate - a.admissionRate);
  results.reach.sort((a, b) => b.admissionRate - a.admissionRate);

  // Limit each category to 5 programs (max 15 total)
  const PER_CATEGORY = 5;
  results.safety = results.safety.slice(0, PER_CATEGORY);
  results.target = results.target.slice(0, PER_CATEGORY);
  results.reach = results.reach.slice(0, PER_CATEGORY);

  results.stats.totalPrograms = results.safety.length + results.target.length + results.reach.length;

  return results;
}
