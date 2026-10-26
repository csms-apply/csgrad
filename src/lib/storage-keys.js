// Centralized localStorage / sessionStorage key registry.
// Keep keys here so a rename / data migration can be done in one place.
export const STORAGE_KEYS = {
  applicantDraft: 'dp_applicant_draft',
  // Old kanban tracker cards; read once to seed trackerPicks, never written.
  trackerData: 'csgrad_tracker_data',
  trackerPicks: 'csgrad_tracker_picks',
};
