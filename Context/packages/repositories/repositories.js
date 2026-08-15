import { DEMO_META, withDemoMeta } from "../domain-models/models.js";
import { activities, announcements, conversationResponses, courses, demoProfile, faqs, programmes, timetable } from "../mock-data/fixtures.js";
import { validateCollection, validateRecord } from "../validation/validation.js";

function requestedState() {
  const state = new URLSearchParams(window.location.search).get("state");
  return state === "empty" || state === "error" ? state : "success";
}

function delay(value, milliseconds = 180) {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), milliseconds));
}

export function createLocalRepository(name, records, requiredFields = ["id"]) {
  return {
    name,
    async list() {
      if (requestedState() === "error") return delay({ status: "error", error: `${name} demo adapter is unavailable.` });
      if (!validateCollection(records, requiredFields)) return delay({ status: "error", error: `${name} fixture validation failed.` });
      if (requestedState() === "empty") return delay({ status: "empty", data: [], meta: DEMO_META });
      return delay({ status: "success", data: [...records], meta: DEMO_META });
    },
    async get(id) {
      const result = await this.list();
      if (result.status !== "success") return result;
      const record = result.data.find((item) => item.id === id);
      return record ? { status: "success", data: record, meta: DEMO_META } : { status: "empty", data: null, meta: DEMO_META };
    }
  };
}

export const repositories = Object.freeze({
  programmes: createLocalRepository("Programmes", programmes, ["id", "name"]),
  faqs: createLocalRepository("FAQs", faqs, ["id", "question", "answer"]),
  announcements: createLocalRepository("Announcements", announcements, ["id", "title"]),
  timetable: createLocalRepository("Timetable", timetable, ["id", "day", "course"]),
  courses: createLocalRepository("Courses", courses, ["id", "code", "name"]),
  activities: createLocalRepository("Activities", activities, ["id", "title"]),
  profile: {
    name: "Student profile",
    async get() {
      if (requestedState() === "error") return delay({ status: "error", error: "Student profile demo adapter is unavailable." });
      if (requestedState() === "empty") return delay({ status: "empty", data: null, meta: DEMO_META });
      return delay({ status: "success", data: { ...demoProfile }, meta: DEMO_META });
    }
  },
  conversation: {
    name: "Conversation",
    async respond(message) {
      if (!validateRecord({ message }, ["message"])) return delay({ status: "error", error: "Please enter a question." });
      if (requestedState() === "error") return delay({ status: "error", error: "The scripted conversation adapter is unavailable." });
      const normalized = message.toLowerCase();
      const match = conversationResponses.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
      const response = match || { id: "conversation-fallback", answer: "This is a scripted demonstration response. Try asking about admissions, fees, or support.", citation: "Demo source · Fallback response" };
      return delay({ status: "success", data: response, meta: withDemoMeta(null, { responseType: "scripted" }) });
    }
  }
});

export { requestedState };
