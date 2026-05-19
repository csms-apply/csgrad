// Shared constants for the DataPoints feature.
//
// Centralized here so api.js and page components can import the same values
// instead of duplicating magic numbers. Keep this file tiny and dependency-free.

// UI paging: number of rows shown per page in the DP table.
export const PAGE_SIZE = 50;

// Hard upper bound on rows returned to the client for any single query.
// Prevents the UI from trying to render 2k+ rows even if the API misbehaves.
export const MAX_RESULTS = 500;

// Debounce window for filter-change → live API refetch (ms).
export const API_DEBOUNCE_MS = 250;

// Default `limit` we send to the live `/api/dp` endpoint.
export const LIST_LIMIT_API = 200;

// Cap when filtering the local snapshot fallback (also the per-page upper bound
// honored by filterSnapshot).
export const LIST_LIMIT_SNAPSHOT_FALLBACK = 200;
