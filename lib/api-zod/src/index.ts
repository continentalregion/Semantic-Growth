export * from "./generated/api";
export * from "./generated/types";

// Disambiguation: endpoints that have BOTH a path param and a query param
// (e.g. GET /users/{id}/sgi-history) cause orval to emit the path-params name
// as both a zod schema (./generated/api) and a TS type (./generated/types),
// which makes the two `export *` above ambiguous (TS2308). An explicit named
// re-export takes precedence over star exports and resolves the conflict; we
// keep the zod schema since that is this package's purpose.
export { GetUserSgiHistoryParams } from "./generated/api";
export { UpdateThreadCandidateBody } from "./generated/api";
