// The API is served by the same nginx host as the Docusaurus site. Keeping the
// base empty produces relative `/api/...` URLs, so csgrad.com and
// www.csgrad.com each retain a first-party login cookie.
export const API_BASE_URL = '';

// Compatibility name used by the positioning pages while the old Worker is
// kept online as a rollback target.
export const WORKER_BASE_URL = API_BASE_URL;
