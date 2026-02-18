/**
 * Auto-generate static/data/programs.json from docs/ tier folders.
 * Run: node scripts/generate-programs.js
 */
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OUTPUT_FILE = path.join(__dirname, '..', 'static', 'data', 'programs.json');

const TIERS = ['SSS', 'SS', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+'];

// School abbreviation (lowercase) → full display name
const SCHOOL_MAP = {
  'utah state university': 'Utah State University',
  'cornell tech': 'Cornell Tech',
  'stanford': 'Stanford University',
  'princeton': 'Princeton University',
  'harvard': 'Harvard University',
  'cornell': 'Cornell University',
  'columbia': 'Columbia University',
  'duke': 'Duke University',
  'brown': 'Brown University',
  'emory': 'Emory University',
  'rice': 'Rice University',
  'rics': 'Rice University',
  'yale': 'Yale University',
  'caltech': 'Caltech',
  'cmu': 'Carnegie Mellon University',
  'mit': 'MIT',
  'ucb': 'UC Berkeley',
  'ucla': 'UCLA',
  'ucsd': 'UCSD',
  'ucsb': 'UCSB',
  'uci': 'UC Irvine',
  'usc': 'USC',
  'upenn': 'UPenn',
  'umich': 'University of Michigan',
  'umd': 'University of Maryland',
  'umass': 'UMass Amherst',
  'umn': 'University of Minnesota',
  'uchicago': 'University of Chicago',
  'uiuc': 'UIUC',
  'ut': 'UT Austin',
  'uw': 'University of Washington',
  'uwt': 'University of Washington Tacoma',
  'wisc': 'UW-Madison',
  'gatech': 'Georgia Tech',
  'jhu': 'Johns Hopkins University',
  'nyu': 'NYU',
  'nwu': 'Northwestern University',
  'neu': 'Northeastern University',
  'ncsu': 'NC State',
  'tamu': 'Texas A&M',
  'utsu': 'Utah State University',
};

/**
 * Extract the first H1 heading from a markdown file.
 */
function extractH1(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Match school name from the beginning of an H1 string.
 * Returns { school, program }.
 */
function parseSchoolAndProgram(h1) {
  const lower = h1.toLowerCase();
  // Sort keys longest-first so "cornell tech" matches before "cornell"
  const keys = Object.keys(SCHOOL_MAP).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    if (lower.startsWith(key + ' ')) {
      const program = h1.substring(key.length).trim();
      return { school: SCHOOL_MAP[key], program };
    }
    if (lower === key) {
      return { school: SCHOOL_MAP[key], program: '' };
    }
  }

  // Fallback: first word is school, rest is program
  const spaceIdx = h1.indexOf(' ');
  if (spaceIdx > 0) {
    return { school: h1.substring(0, spaceIdx), program: h1.substring(spaceIdx + 1) };
  }
  return { school: h1, program: '' };
}

/**
 * Generate a stable kebab-case id.
 */
function generateId(tier, school, program) {
  const t = tier.toLowerCase().replace('+', 'plus').replace('-', 'minus');
  const s = school.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const p = program.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return p ? `${t}-${s}-${p}` : `${t}-${s}`;
}

// ---- main ----
const programs = [];

for (const tier of TIERS) {
  const tierDir = path.join(DOCS_DIR, tier);
  if (!fs.existsSync(tierDir)) continue;

  const files = fs.readdirSync(tierDir).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(tierDir, file);
    const slug = `/${tier}/${file.replace(/\.md$/, '')}`;
    const h1 = extractH1(filePath);
    if (!h1) continue;

    const { school, program } = parseSchoolAndProgram(h1);
    const id = generateId(tier, school, program);

    programs.push({ id, school, program, tier, slug });
  }
}

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(programs, null, 2) + '\n');

console.log(`Generated ${programs.length} programs → ${path.relative(process.cwd(), OUTPUT_FILE)}`);
