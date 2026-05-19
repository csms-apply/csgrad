// Drizzle ORM schema for csgrad D1.
//
// This file is the JS-facing twin of migrations/0001_init.sql. Both must stay
// in sync — when you change one, change the other. We intentionally do not
// use drizzle-kit's generator so the SQL is committable and reviewable.
//
// Conventions:
//   - JS property names: camelCase
//   - DB column names:   snake_case (matches the migration INSERTs from
//                         scripts/migrate-seatable-to-d1.mjs)
//   - Better-auth tables use the names better-auth expects (user/account/
//                         session/verification) — do not rename them or its
//                         adapter will break.

import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// better-auth: user / account / session / verification
// Follow better-auth's expected schema (camelCase column names).
// ---------------------------------------------------------------------------

export const user = sqliteTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),

    // csgrad-specific extensions:
    nickname: text('nickname').notNull(),
    showRealName: integer('showRealName', { mode: 'boolean' }).notNull().default(false),
    role: text('role').notNull().default('user'),
  },
  (t) => ({
    emailIdx: uniqueIndex('user_email_unique').on(t.email),
    nicknameIdx: uniqueIndex('user_nickname_unique').on(t.nickname),
  }),
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    providerAccountIdx: uniqueIndex('account_provider_account_unique').on(t.providerId, t.accountId),
    userIdx: index('account_user_idx').on(t.userId),
  }),
);

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('session_token_unique').on(t.token),
    userIdx: index('session_user_idx').on(t.userId),
    expiresIdx: index('session_expires_idx').on(t.expiresAt),
  }),
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp' }),
    updatedAt: integer('updatedAt', { mode: 'timestamp' }),
  },
  (t) => ({
    identifierIdx: index('verification_identifier_idx').on(t.identifier),
  }),
);

// ---------------------------------------------------------------------------
// Business tables (snake_case column names)
// ---------------------------------------------------------------------------

export const applicants = sqliteTable(
  'applicants',
  {
    id: text('id').primaryKey(),
    seatableRowId: text('seatable_row_id'),
    seatableApplicantId: integer('seatable_applicant_id'),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),

    // Education
    ugSchoolCategory: text('ug_school_category'),
    ugSchoolName: text('ug_school_name'),
    graduationYear: integer('graduation_year'),
    ugMajor: text('ug_major'),
    honorsCollege: integer('honors_college', { mode: 'boolean' }),
    exchangeAbroad: integer('exchange_abroad', { mode: 'boolean' }),
    dualDegree: integer('dual_degree', { mode: 'boolean' }),
    educationNotes: text('education_notes'),
    csCourses: text('cs_courses'), // JSON array

    // Grades
    gpaScale: text('gpa_scale'),
    gpa: real('gpa'),
    gpaRank: text('gpa_rank'),
    gpaNotes: text('gpa_notes'),

    // Language: TOEFL
    toeflTotal: integer('toefl_total'),
    toeflReading: integer('toefl_reading'),
    toeflListening: integer('toefl_listening'),
    toeflSpeaking: integer('toefl_speaking'),
    toeflWriting: integer('toefl_writing'),

    // Language: IELTS
    ieltsTotal: real('ielts_total'),
    ieltsReading: real('ielts_reading'),
    ieltsListening: real('ielts_listening'),
    ieltsSpeaking: real('ielts_speaking'),
    ieltsWriting: real('ielts_writing'),

    // GRE
    greTotal: integer('gre_total'),
    greQuant: integer('gre_quant'),
    greVerbal: integer('gre_verbal'),
    greWriting: real('gre_writing'),

    // Research / internship
    researchDomesticCount: integer('research_domestic_count'),
    researchOverseasCount: integer('research_overseas_count'),
    researchNotes: text('research_notes'),
    internshipDomesticCount: integer('internship_domestic_count'),
    internshipOverseasCount: integer('internship_overseas_count'),
    internshipNotes: text('internship_notes'),

    // Recommendation letters (5 × JSON array of tags)
    rec1Tags: text('rec1_tags'),
    rec2Tags: text('rec2_tags'),
    rec3Tags: text('rec3_tags'),
    rec4Tags: text('rec4_tags'),
    rec5Tags: text('rec5_tags'),
    recNotes: text('rec_notes'),

    // Publications
    pubTopFirstAuthor: integer('pub_top_first_author', { mode: 'boolean' }),
    pubTopOtherAuthor: integer('pub_top_other_author', { mode: 'boolean' }),
    submissionTopFirstAuthor: integer('submission_top_first_author', { mode: 'boolean' }),
    submissionTopOtherAuthor: integer('submission_top_other_author', { mode: 'boolean' }),
    pubNotes: text('pub_notes'),

    // Misc
    otherSoftBackground: text('other_soft_background'),
    contactInfo: text('contact_info'),

    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
    lockedAt: text('locked_at'),
  },
  (t) => ({
    userIdx: uniqueIndex('applicants_user_unique').on(t.userId),
    ugCategoryIdx: index('applicants_ug_category_idx').on(t.ugSchoolCategory),
    majorIdx: index('applicants_major_idx').on(t.ugMajor),
    gradYearIdx: index('applicants_grad_year_idx').on(t.graduationYear),
    gpaIdx: index('applicants_gpa_idx').on(t.gpa),
    seatableIdx: uniqueIndex('applicants_seatable_row_unique').on(t.seatableRowId),
  }),
);

export const programs = sqliteTable(
  'programs',
  {
    id: text('id').primaryKey(),
    seatableRowId: text('seatable_row_id'),
    seatableProgramId: integer('seatable_program_id'),
    school: text('school').notNull(),
    program: text('program').notNull(),
    degree: text('degree'),
    country: text('country'),
    countryLat: real('country_lat'),
    countryLng: real('country_lng'),
    homepageUrl: text('homepage_url'),
    tier: text('tier'),
    aliases: text('aliases'), // JSON array
    status: text('status').notNull().default('active'),
    submittedBy: text('submitted_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: text('created_at'),
  },
  (t) => ({
    schoolProgramIdx: uniqueIndex('programs_school_program_unique').on(t.school, t.program),
    schoolIdx: index('programs_school_idx').on(t.school),
    tierIdx: index('programs_tier_idx').on(t.tier),
    countryIdx: index('programs_country_idx').on(t.country),
    seatableIdx: uniqueIndex('programs_seatable_row_unique').on(t.seatableRowId),
  }),
);

export const datapoints = sqliteTable(
  'datapoints',
  {
    id: text('id').primaryKey(),
    seatableRowId: text('seatable_row_id'),
    seatableDpId: integer('seatable_dp_id'),
    applicantId: text('applicant_id').notNull().references(() => applicants.id, {
      onDelete: 'cascade',
    }),
    programId: text('program_id').notNull().references(() => programs.id, {
      onDelete: 'restrict',
    }),
    result: text('result'),
    isFunded: integer('is_funded', { mode: 'boolean' }),
    isFinalDestination: integer('is_final_destination', { mode: 'boolean' }),
    academicYear: integer('academic_year'),
    semester: text('semester'),
    notifiedAt: text('notified_at'),
    submittedAt: text('submitted_at'),
    notes: text('notes'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (t) => ({
    // Not unique: legitimate flows produce multiple rows (waitlist → admit,
    // withdraw → admit). Soft-dedup at API layer on POST /api/dp.
    dedupIdx: index('datapoints_dedup_idx').on(
      t.applicantId,
      t.programId,
      t.academicYear,
      t.semester,
    ),
    applicantIdx: index('datapoints_applicant_idx').on(t.applicantId),
    programResultIdx: index('datapoints_program_result_idx').on(t.programId, t.result),
    notifiedIdx: index('datapoints_notified_idx').on(t.notifiedAt),
    seatableIdx: uniqueIndex('datapoints_seatable_row_unique').on(t.seatableRowId),
  }),
);
