/** Future boundary for a backend-backed repository. No transport is used in Phase 1. */
export function createHttpRepositoryAdapter() {
  return {
    async list() {
      return { status: "error", error: "HTTP adapter is reserved for a future backend phase." };
    },
    async get() {
      return { status: "error", error: "HTTP adapter is reserved for a future backend phase." };
    }
  };
}
