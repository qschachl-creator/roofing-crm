export const SAVED_LEADS_STORAGE_KEY = "roofing-crm-saved-leads";

export type SavedLeadPermit = {
  permitNumber: string;
  status: string;
  openDuration: string;
  contractor: string;
  longOpen: boolean;
};

export type SavedLead = {
  objectId: string;
  apn: string;
  address: string;
  jurisdiction: string | null;
  roofAgeSentence?: string;
  permits?: SavedLeadPermit[];
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

  return parsed.flatMap((value) => {
    const lead = parseSavedLead(value);
    return lead ? [lead] : [];
  });
}

function parseSavedLead(value: unknown): SavedLead | null {
  if (!value || typeof value !== "object") return null;

  const lead = value as Record<string, unknown>;
  const jurisdiction = lead.jurisdiction;
  if (
    typeof lead.objectId !== "string" ||
    typeof lead.apn !== "string" ||
    typeof lead.address !== "string" ||
    (jurisdiction !== null && typeof jurisdiction !== "string")
  ) {
    return null;
  }

  const saved: SavedLead = {
    objectId: lead.objectId,
    apn: lead.apn,
    address: lead.address,
    jurisdiction,
  };

  if (typeof lead.roofAgeSentence === "string") {
    saved.roofAgeSentence = lead.roofAgeSentence;
  }

  if (Array.isArray(lead.permits)) {
    saved.permits = lead.permits.flatMap((permit) => {
      const parsed = parseSavedPermit(permit);
      return parsed ? [parsed] : [];
    });
  }

  return saved;
}

function parseSavedPermit(value: unknown): SavedLeadPermit | null {
  if (!value || typeof value !== "object") return null;

  const permit = value as Record<string, unknown>;
  if (
    typeof permit.permitNumber !== "string" ||
    typeof permit.status !== "string" ||
    typeof permit.openDuration !== "string" ||
    typeof permit.contractor !== "string"
  ) {
    return null;
  }

  return {
    permitNumber: permit.permitNumber,
    status: permit.status,
    openDuration: permit.openDuration,
    contractor: permit.contractor,
    longOpen: permit.longOpen === true,
  };
}
