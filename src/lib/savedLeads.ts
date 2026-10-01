export const SAVED_LEADS_STORAGE_KEY = "roofing-crm-saved-leads";

export type SavedLead = {
  objectId: string;
  apn: string;
  address: string;
  jurisdiction: string | null;
};

const EMPTY_LEADS: SavedLead[] = [];
const SAVED_LEADS_CHANGE = "roofing-crm-leads";
let cachedRaw: string | null | undefined;
let cachedLeads: SavedLead[] = EMPTY_LEADS;

export function readSavedLeads(): SavedLead[] {
  if (typeof window === "undefined") return EMPTY_LEADS;

  const raw = window.localStorage.getItem(SAVED_LEADS_STORAGE_KEY);
  if (raw === cachedRaw) return cachedLeads;

  cachedRaw = raw;
  cachedLeads = parseSavedLeads(raw);
  return cachedLeads;
}

export function writeSavedLeads(leads: SavedLead[]) {
  const raw = JSON.stringify(leads);
  window.localStorage.setItem(SAVED_LEADS_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedLeads = leads;
  window.dispatchEvent(new Event(SAVED_LEADS_CHANGE));
}

export function subscribeSavedLeads(onChange: () => void) {
  window.addEventListener(SAVED_LEADS_CHANGE, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(SAVED_LEADS_CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function savedLeadsServerSnapshot(): SavedLead[] {
  return EMPTY_LEADS;
}

export function parseSavedLeads(raw: string | null): SavedLead[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isSavedLead);
}

function isSavedLead(value: unknown): value is SavedLead {
  if (!value || typeof value !== "object") return false;

  const lead = value as Record<string, unknown>;

  return (
    typeof lead.objectId === "string" &&
    typeof lead.apn === "string" &&
    typeof lead.address === "string" &&
    (lead.jurisdiction === null || typeof lead.jurisdiction === "string")
  );
}
