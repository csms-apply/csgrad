-- 0001_init.sql — csgrad D1 initial schema.
-- Apply with:  wrangler d1 execute DB_CSGRAD --file=migrations/0001_init.sql
--
-- Hand-written to stay in sync with ../schema.ts.  When you change one,
-- change the other.

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- better-auth: user / account / session / verification
-- Column names are camelCase to match better-auth defaults — do NOT rename.
-- ===========================================================================

CREATE TABLE user (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  emailVerified   INTEGER NOT NULL DEFAULT 0,
  image           TEXT,
  createdAt       INTEGER NOT NULL,
  updatedAt       INTEGER NOT NULL,

  nickname        TEXT NOT NULL,
  showRealName    INTEGER NOT NULL DEFAULT 0,
  role            TEXT NOT NULL DEFAULT 'user'
);
CREATE UNIQUE INDEX user_email_unique     ON user(email);
CREATE UNIQUE INDEX user_nickname_unique  ON user(nickname);

CREATE TABLE account (
  id                     TEXT PRIMARY KEY,
  userId                 TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accountId              TEXT NOT NULL,
  providerId             TEXT NOT NULL,
  accessToken            TEXT,
  refreshToken           TEXT,
  idToken                TEXT,
  accessTokenExpiresAt   INTEGER,
  refreshTokenExpiresAt  INTEGER,
  scope                  TEXT,
  password               TEXT,
  createdAt              INTEGER NOT NULL,
  updatedAt              INTEGER NOT NULL
);
CREATE UNIQUE INDEX account_provider_account_unique ON account(providerId, accountId);
CREATE INDEX account_user_idx ON account(userId);

CREATE TABLE session (
  id         TEXT PRIMARY KEY,
  userId     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  expiresAt  INTEGER NOT NULL,
  ipAddress  TEXT,
  userAgent  TEXT,
  createdAt  INTEGER NOT NULL,
  updatedAt  INTEGER NOT NULL
);
CREATE UNIQUE INDEX session_token_unique ON session(token);
CREATE INDEX session_user_idx    ON session(userId);
CREATE INDEX session_expires_idx ON session(expiresAt);

CREATE TABLE verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  INTEGER NOT NULL,
  createdAt  INTEGER,
  updatedAt  INTEGER
);
CREATE INDEX verification_identifier_idx ON verification(identifier);

-- ===========================================================================
-- Business tables (snake_case column names)
-- ===========================================================================

CREATE TABLE applicants (
  id                              TEXT PRIMARY KEY,
  seatable_row_id                 TEXT,
  seatable_applicant_id           INTEGER,
  user_id                         TEXT REFERENCES user(id) ON DELETE SET NULL,

  ug_school_category              TEXT,
  ug_school_name                  TEXT,
  graduation_year                 INTEGER,
  ug_major                        TEXT,
  honors_college                  INTEGER,
  exchange_abroad                 INTEGER,
  dual_degree                     INTEGER,
  education_notes                 TEXT,
  cs_courses                      TEXT,

  gpa_scale                       TEXT,
  gpa                             REAL,
  gpa_rank                        TEXT,
  gpa_notes                       TEXT,

  toefl_total                     INTEGER,
  toefl_reading                   INTEGER,
  toefl_listening                 INTEGER,
  toefl_speaking                  INTEGER,
  toefl_writing                   INTEGER,

  ielts_total                     REAL,
  ielts_reading                   REAL,
  ielts_listening                 REAL,
  ielts_speaking                  REAL,
  ielts_writing                   REAL,

  gre_total                       INTEGER,
  gre_quant                       INTEGER,
  gre_verbal                      INTEGER,
  gre_writing                     REAL,

  research_domestic_count         INTEGER,
  research_overseas_count         INTEGER,
  research_notes                  TEXT,
  internship_domestic_count       INTEGER,
  internship_overseas_count       INTEGER,
  internship_notes                TEXT,

  rec1_tags                       TEXT,
  rec2_tags                       TEXT,
  rec3_tags                       TEXT,
  rec4_tags                       TEXT,
  rec5_tags                       TEXT,
  rec_notes                       TEXT,

  pub_top_first_author            INTEGER,
  pub_top_other_author            INTEGER,
  submission_top_first_author     INTEGER,
  submission_top_other_author     INTEGER,
  pub_notes                       TEXT,

  other_soft_background           TEXT,
  contact_info                    TEXT,

  created_at                      TEXT,
  updated_at                      TEXT,
  locked_at                       TEXT
);
CREATE UNIQUE INDEX applicants_user_unique          ON applicants(user_id);
CREATE INDEX        applicants_ug_category_idx      ON applicants(ug_school_category);
CREATE INDEX        applicants_major_idx            ON applicants(ug_major);
CREATE INDEX        applicants_grad_year_idx        ON applicants(graduation_year);
CREATE INDEX        applicants_gpa_idx              ON applicants(gpa);
CREATE UNIQUE INDEX applicants_seatable_row_unique  ON applicants(seatable_row_id);

CREATE TABLE programs (
  id                    TEXT PRIMARY KEY,
  seatable_row_id       TEXT,
  seatable_program_id   INTEGER,
  school                TEXT NOT NULL,
  program               TEXT NOT NULL,
  degree                TEXT,
  country               TEXT,
  country_lat           REAL,
  country_lng           REAL,
  homepage_url          TEXT,
  tier                  TEXT,
  aliases               TEXT,
  status                TEXT NOT NULL DEFAULT 'active',
  submitted_by          TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at            TEXT
);
CREATE UNIQUE INDEX programs_school_program_unique  ON programs(school, program);
CREATE INDEX        programs_school_idx             ON programs(school);
CREATE INDEX        programs_tier_idx               ON programs(tier);
CREATE INDEX        programs_country_idx            ON programs(country);
CREATE UNIQUE INDEX programs_seatable_row_unique    ON programs(seatable_row_id);

CREATE TABLE datapoints (
  id                       TEXT PRIMARY KEY,
  seatable_row_id          TEXT,
  seatable_dp_id           INTEGER,
  applicant_id             TEXT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  program_id               TEXT NOT NULL REFERENCES programs(id)   ON DELETE RESTRICT,
  result                   TEXT,
  is_funded                INTEGER,
  is_final_destination     INTEGER,
  academic_year            INTEGER,
  semester                 TEXT,
  notified_at              TEXT,
  submitted_at             TEXT,
  notes                    TEXT,
  created_at               TEXT,
  updated_at               TEXT
);
-- Note: NOT enforcing UNIQUE(applicant_id, program_id, academic_year, semester)
-- because legitimate flows produce multiple rows (waitlist → admit, withdraw → admit).
-- Soft-dedup happens at the API layer on POST /api/dp.
CREATE INDEX        datapoints_dedup_idx            ON datapoints(applicant_id, program_id, academic_year, semester);
CREATE INDEX        datapoints_applicant_idx        ON datapoints(applicant_id);
CREATE INDEX        datapoints_program_result_idx   ON datapoints(program_id, result);
CREATE INDEX        datapoints_notified_idx         ON datapoints(notified_at);
CREATE UNIQUE INDEX datapoints_seatable_row_unique  ON datapoints(seatable_row_id);
