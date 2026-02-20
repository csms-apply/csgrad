/**
 * SeaTable API client for querying applicant data.
 *
 * Uses the SeaTable API Gateway v2 with SQL queries.
 * The dtable_uuid is obtained automatically from the access token response.
 */

// ─── Table names ─────────────────────────────────────────────
const TABLE_APPLICANTS = '申请者信息';
const TABLE_DATAPOINTS = 'DataPoints';

// ─── 申请者信息 columns ─────────────────────────────────────
const COL_GPA = '本科GPA';
const COL_GPA_SCALE = '本科分数制';
const COL_SCHOOL_TIER = '本科学校类别';
const COL_MAJOR = '本科专业';
const COL_LINK_DATAPOINTS = 'DataPoints'; // link column to DataPoints table

// ─── DataPoints columns ─────────────────────────────────────
const COL_DP_APPLICANT = '申请者';  // link column
const COL_DP_PROGRAM = '项目';      // link column, display_value = "CS75@UCSD"
const COL_DP_RESULT = '结果';       // single-select: Admit / Reject / Waitlist / 默拒 / Withdraw
const COL_DP_SCHOLARSHIP = '带奖';  // checkbox

/**
 * Get an access token and dtable_uuid for the SeaTable base.
 */
async function getAccessInfo(apiToken) {
  const resp = await fetch('https://cloud.seatable.io/api/v2.1/dtable/app-access-token/', {
    headers: { Authorization: `Token ${apiToken}` },
  });
  if (!resp.ok) throw new Error(`SeaTable auth failed: ${resp.status}`);
  const data = await resp.json();
  return {
    accessToken: data.access_token,
    dtableUuid: data.dtable_uuid,
  };
}

/**
 * Execute a SQL query against the SeaTable base via API Gateway v2.
 */
async function sqlQuery(accessToken, dtableUuid, sql) {
  const resp = await fetch(
    `https://cloud.seatable.io/api-gateway/api/v2/dtables/${dtableUuid}/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, convert_keys: true }),
    }
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SeaTable SQL error: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  if (data.error_message) {
    throw new Error(`SeaTable SQL error: ${data.error_message}`);
  }
  return data.results || [];
}

/**
 * Normalize GPA to 4.0 scale.
 */
function normalizeGpa(gpa, scale) {
  const s = String(scale);
  if (s === '5.0') return (gpa / 5.0) * 4.0;
  if (s === '百分制' || s === '100') return (gpa / 100) * 4.0;
  if (s === '4.3') return (gpa / 4.3) * 4.0;
  return gpa; // already 4.0 scale
}

/**
 * Find similar applicants based on GPA (±range), with auto-widening.
 */
async function findSimilarApplicants(accessToken, dtableUuid, userProfile) {
  const normalizedGpa = normalizeGpa(userProfile.gpa, userProfile.gpaScale);

  for (const range of [0.15, 0.25, 0.4]) {
    const low = Math.max(0, normalizedGpa - range);
    const high = Math.min(4.0, normalizedGpa + range);

    const where = `\`${COL_GPA}\` >= ${low} AND \`${COL_GPA}\` <= ${high}`;
    const sql = `SELECT * FROM \`${TABLE_APPLICANTS}\` WHERE ${where} LIMIT 200`;

    const applicants = await sqlQuery(accessToken, dtableUuid, sql);

    if (applicants.length >= 5 || range >= 0.4) {
      return { applicants, gpaRange: [low, high] };
    }
  }

  return { applicants: [], gpaRange: [0, 4] };
}

/**
 * Get admission results (datapoints) for a set of DataPoints row IDs.
 */
async function getAdmissionResults(accessToken, dtableUuid, dpRowIds) {
  if (dpRowIds.length === 0) return [];

  // Query in batches if needed (SeaTable SQL has limits)
  const allResults = [];
  const batchSize = 100;

  for (let i = 0; i < dpRowIds.length; i += batchSize) {
    const batch = dpRowIds.slice(i, i + batchSize);
    const idList = batch.map((id) => `'${id}'`).join(', ');
    const sql = `SELECT * FROM \`${TABLE_DATAPOINTS}\` WHERE \`_id\` IN (${idList}) LIMIT ${batchSize}`;

    const results = await sqlQuery(accessToken, dtableUuid, sql);
    allResults.push(...results);
  }

  return allResults;
}

/**
 * Extract display value from a SeaTable link column.
 * Link columns return: [{"row_id": "...", "display_value": "..."}]
 */
function getLinkDisplayValue(linkData) {
  if (Array.isArray(linkData) && linkData.length > 0) {
    return linkData[0].display_value || '';
  }
  return '';
}

function getLinkRowId(linkData) {
  if (Array.isArray(linkData) && linkData.length > 0) {
    return linkData[0].row_id || '';
  }
  return '';
}

/**
 * Parse school name from program string.
 * e.g. "CS75@UCSD" → "UCSD", "ECE@Duke" → "Duke"
 */
export function parseSchoolFromProgram(program) {
  if (!program) return '';
  const parts = program.split('@');
  return parts.length > 1 ? parts[parts.length - 1] : program;
}

/**
 * Main query: find similar applicants and their admission results.
 */
export async function querySimilarProfiles(env, userProfile) {
  const { accessToken, dtableUuid } = await getAccessInfo(env.SEATABLE_API_TOKEN);

  // Step 1: Find similar applicants
  const { applicants, gpaRange } = await findSimilarApplicants(accessToken, dtableUuid, userProfile);

  if (applicants.length === 0) {
    return { applicants: [], datapoints: [], gpaRange };
  }

  // Step 2: Collect DataPoints row IDs from the link column
  const dpRowIds = [];
  const applicantRowIdMap = {}; // maps applicant _id → anonymized info

  applicants.forEach((a, idx) => {
    const linkData = a[COL_LINK_DATAPOINTS];
    if (Array.isArray(linkData)) {
      for (const link of linkData) {
        if (link.row_id) {
          dpRowIds.push(link.row_id);
        }
      }
    }

    applicantRowIdMap[a._id] = {
      id: a._id,
      label: `Applicant #${idx + 1}`,
      gpa: Math.round((a[COL_GPA] || 0) * 10) / 10,
      schoolTier: a[COL_SCHOOL_TIER] || '未知',
      major: a[COL_MAJOR] || '',
    };
  });

  if (dpRowIds.length === 0) {
    return { applicants: Object.values(applicantRowIdMap), datapoints: [], gpaRange };
  }

  // Step 3: Get admission results
  const datapoints = await getAdmissionResults(accessToken, dtableUuid, dpRowIds);

  return {
    applicants: Object.values(applicantRowIdMap),
    datapoints,
    gpaRange,
  };
}

export {
  COL_DP_APPLICANT,
  COL_DP_PROGRAM,
  COL_DP_RESULT,
  COL_DP_SCHOLARSHIP,
  getLinkDisplayValue,
  getLinkRowId,
};
