/** Stable record names used by both local and future HTTP adapters. */
export const MODEL_NAMES = Object.freeze({
  programme: "programme",
  faq: "faq",
  announcement: "announcement",
  student: "student",
  timetableEntry: "timetableEntry",
  course: "course",
  activity: "activity",
  conversationResponse: "conversationResponse"
});

export const DEMO_META = Object.freeze({
  mode: "demo",
  source: "local-fixtures",
  live: false
});

export function withDemoMeta(data, extra = {}) {
  return { data, meta: { ...DEMO_META, ...extra } };
}
