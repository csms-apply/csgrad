export const TRACKER_BACKUP_KEY = 'csgrad_tracker_before_import';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const columns = new Set(['reach', 'match', 'target', 'safety']);
const essayStatuses = new Set(['not_started', 'drafting', 'reviewing', 'done']);
const stringFields = ['id', 'school', 'program', 'deadline', 'toefl', 'gre', 'notes', 'tier', 'slug'];

/** Validate the existing exported-array format before changing any saved data. */
export function parseTrackerBackup(raw) {
  const cards = JSON.parse(raw);
  if (!Array.isArray(cards)) throw new Error('invalid-backup');
  const ids = new Set();
  for (const card of cards) {
    if (!card || typeof card !== 'object' || Array.isArray(card)
      || stringFields.some((key) => typeof card[key] !== 'string')
      || !card.id.trim() || ids.has(card.id)
      || (!card.school && !card.program)
      || !columns.has(card.column) || !essayStatuses.has(card.essayStatus)
      || typeof card.fromLibrary !== 'boolean'
      || !Array.isArray(card.lors)
      || card.lors.some((lor) => !lor || typeof lor.name !== 'string' || typeof lor.done !== 'boolean')
      || (card.libraryId !== undefined && (typeof card.libraryId !== 'string' || !card.libraryId.trim()))
      || (card.fromLibrary && !card.libraryId)
      || (card.slug && (!card.slug.startsWith('/') || card.slug.startsWith('//') || /[\\\u0000-\u001f]/.test(card.slug)))
    ) throw new Error('invalid-backup');
    if (card.deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(card.deadline)
      || Number.isNaN(Date.parse(card.deadline))
      || new Date(card.deadline).toISOString().slice(0, 10) !== card.deadline)) {
      throw new Error('invalid-backup');
    }
    ids.add(card.id);
  }
  return cards;
}
