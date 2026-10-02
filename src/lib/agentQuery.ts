import { permitAgeYears } from "./candidateList.ts";
import {
  meetsMinimumRoofAge,
  roofAgeCardLabel,
  undashedApn,
} from "./roofAgeProof.ts";

export type AgentParcel = {
  apn: string;
  address: string;
};

export type AgentPermit = {
  apn: string;
  permitNumber: string;
  finalDate: string | null;
  issueDate: string | null;
  contractorName: string | null;
};

export type AgentMatch = {
  apn: string;
  address: string;
  detail: string;
};

export type AgentAnswer = {
  answer: string;
  matches: AgentMatch[];
};

const BBB_NOTE = "BBB rating is unavailable in the current data.";
const ROOF_BASIS =
  "Roof age is the years since the completed re-roof date in the published snapshot.";
const PERMIT_BASIS =
  "Open means no final date. Duration is the years since the San Jose issue date. The contractor is the name on that permit.";

export const SANTA_CLARA_CITY_CENTERS = [
  { name: "San Jose", lat: 37.3382, lng: -121.8863 },
  { name: "Santa Clara", lat: 37.3541, lng: -121.9552 },
  { name: "Sunnyvale", lat: 37.3688, lng: -122.0363 },
  { name: "Mountain View", lat: 37.3861, lng: -122.0839 },
  { name: "Palo Alto", lat: 37.4419, lng: -122.143 },
  { name: "Milpitas", lat: 37.4323, lng: -121.8996 },
  { name: "Cupertino", lat: 37.323, lng: -122.0322 },
  { name: "Campbell", lat: 37.2872, lng: -121.95 },
  { name: "Los Gatos", lat: 37.2358, lng: -121.9624 },
  { name: "Saratoga", lat: 37.2638, lng: -122.023 },
  { name: "Morgan Hill", lat: 37.1305, lng: -121.6544 },
  { name: "Gilroy", lat: 37.0058, lng: -121.5683 },
] as const;

const SEARCH_RADIUS_MILES = new Set([1, 3, 5, 10, 25]);

const PLACE_STOP = new Set([
  "a",
  "an",
  "the",
  "this",
  "that",
  "these",
  "those",
  "my",
  "our",
  "your",
  "me",
  "open",
  "roofing",
  "roof",
  "roofs",
  "permit",
  "permits",
  "property",
  "properties",
  "parcel",
  "parcels",
  "year",
  "years",
  "mile",
  "miles",
  "search",
  "radius",
  "area",
  "current",
  "loaded",
  "older",
  "than",
  "within",
  "show",
  "one",
  "two",
  "three",
  "four",
  "five",
  "ten",
  "fifteen",
  "twenty",
  "twenty-five",
]);

export type QuestionPlace =
  | {
      kind: "known";
      name: string;
      lat: number;
      lng: number;
      radiusMiles: number | null;
    }
  | { kind: "unknown"; name: string }
  | { kind: "none" };

function cityPattern(name: string) {
  return new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`, "gi");
}

function cityHits(question: string) {
  const hits: {
    name: string;
    lat: number;
    lng: number;
    index: number;
  }[] = [];

  for (const city of SANTA_CLARA_CITY_CENTERS) {
    for (const match of question.matchAll(cityPattern(city.name))) {
      const index = match.index ?? 0;
      const after = question.slice(index + match[0].length);
      if (/^\s+county\b/i.test(after)) continue;

      hits.push({
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        index,
      });
    }
  }

  return hits.sort((left, right) => left.index - right.index);
}

function isPlacePhrase(question: string, index: number) {
  return /\b(?:of|near|around|in)\s+$/i.test(question.slice(0, index));
}

export function questionSearchPlace(question: string): QuestionPlace {
  const trimmed = question.trim();
  const hits = cityHits(trimmed);

  if (hits.length > 0) {
    const placed = hits.filter((hit) => isPlacePhrase(trimmed, hit.index));
    const chosen = placed.length > 0 ? placed[placed.length - 1] : hits[0];
    const askedMiles = askedRadiusMiles(trimmed);

    return {
      kind: "known",
      name: chosen.name,
      lat: chosen.lat,
      lng: chosen.lng,
      radiusMiles:
        askedMiles !== null && SEARCH_RADIUS_MILES.has(askedMiles)
          ? askedMiles
          : null,
    };
  }

  const unknown = unknownPlaceName(trimmed);
  if (unknown) return { kind: "unknown", name: unknown };

  return { kind: "none" };
}

function unknownPlaceName(question: string) {
  const pattern =
    /\b(?:of|near|around|in)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi;

  for (const match of question.matchAll(pattern)) {
    const name = match[1].trim();
    const after = question.slice((match.index ?? 0) + match[0].length);
    if (/^\s+county\b/i.test(after)) continue;
    if (PLACE_STOP.has(name.split(/\s+/)[0].toLowerCase())) continue;
    if (
      SANTA_CLARA_CITY_CENTERS.some(
        (city) => city.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      continue;
    }
    return name;
  }

  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  "twenty-five": 25,
};

function askedRadiusMiles(question: string) {
  const fromPhrase = firstQuantity(question, "mile");
  if (fromPhrase !== null) return fromPhrase;

  const singular = question.match(/\b(25|10|5|3|1)\s+mile\b/i);
  return singular ? Number(singular[1]) : null;
}

function firstQuantity(question: string, unit: "mile" | "year") {
  const digits = question.match(
    new RegExp(`(\\d+)\\s*-?\\s*${unit}s?\\b`, "i")
  );
  if (digits) {
    const value = Number(digits[1]);
    return Number.isFinite(value) ? value : null;
  }

  const words = question.match(
    new RegExp(
      `(twenty-five|fifteen|twenty|ten|five|four|three|two|one)\\s*-?\\s*${unit}s?\\b`,
      "i"
    )
  );
  if (!words) return null;

  return NUMBER_WORDS[words[1].toLowerCase()] ?? null;
}

function mileLabel(miles: number) {
  return `${miles} ${miles === 1 ? "mile" : "miles"}`;
}

function searchLabel(miles: number) {
  return `${miles}-mile search`;
}

function loadedRadiusNote(askedMiles: number | null, loadedMiles: number) {
  if (askedMiles === null || askedMiles === loadedMiles) return "";

  if (askedMiles > loadedMiles) {
    return ` The loaded search covers ${mileLabel(loadedMiles)}, which is smaller than the ${mileLabel(askedMiles)} asked.`;
  }

  return ` The loaded search covers ${mileLabel(loadedMiles)}, which is larger than the ${mileLabel(askedMiles)} asked, so this list is not limited to ${mileLabel(askedMiles)}.`;
}

function parcelForPermit(
  parcels: readonly AgentParcel[],
  apn: string
) {
  const key = undashedApn(apn);
  return parcels.find((parcel) => undashedApn(parcel.apn) === key);
}

export function answerRoofingQuestion(
  question: string,
  input: {
    parcels: readonly AgentParcel[];
    permits: readonly AgentPermit[];
    radiusMiles: number | null;
    hasSearched: boolean;
    permitError?: string | null;
    permitStatus?: "open" | "all" | null;
    truncated?: boolean;
    now?: number;
  }
): AgentAnswer {
  const trimmed = question.trim();

  if (!trimmed) {
    return {
      answer: "Ask about roofs or open permits in the current search.",
      matches: [],
    };
  }

  const place = questionSearchPlace(trimmed);
  if (place.kind === "unknown") {
    return {
      answer: `${place.name} is not in the Santa Clara County city list, so no search was run.`,
      matches: [],
    };
  }

  if (!input.hasSearched || input.radiusMiles === null) {
    return {
      answer:
        "Search a map radius first. Answers use the parcels and permits already loaded for that search.",
      matches: [],
    };
  }

  const askedMiles = firstQuantity(trimmed, "mile");
  const askedYears = firstQuantity(trimmed, "year");
  const asksOpenPermit =
    /\bopen\b/i.test(trimmed) && /\bpermits?\b/i.test(trimmed);
  const asksRoof = /\broofs?\b/i.test(trimmed) && !asksOpenPermit;
  const radiusNote = loadedRadiusNote(askedMiles, input.radiusMiles);
  const coverageNote = input.truncated
    ? " The county returned more parcels than this page, so this answer covers only the parcels that were loaded."
    : "";

  if (!asksOpenPermit && !asksRoof) {
    return {
      answer: `Ask about roofs older than a number of years, or open roofing permits older than a number of years, inside this ${input.radiusMiles}-mile search. ${BBB_NOTE}`,
      matches: [],
    };
  }

  if (asksOpenPermit) {
    const minimumYears = askedYears;

    if (input.permitError) {
      return {
        answer: `Permit records did not load for this search (${input.permitError}). ${BBB_NOTE}`,
        matches: [],
      };
    }

    const seenPermitNumbers = new Set<string>();
    const matches = input.permits.flatMap((permit) => {
      if (seenPermitNumbers.has(permit.permitNumber)) return [];

      const age = permitAgeYears(permit.issueDate, input.now);
      const open =
        !permit.finalDate &&
        (minimumYears === null || (age !== null && age >= minimumYears));
      if (!open) return [];

      seenPermitNumbers.add(permit.permitNumber);
      const parcel = parcelForPermit(input.parcels, permit.apn);
      if (!parcel) return [];

      const contractor = permit.contractorName?.trim();
      const duration =
        age === null
          ? "issue date was not returned"
          : `${age.toFixed(1)} years since issue`;

      return [
        {
          apn: parcel.apn,
          address: parcel.address || "Address unavailable",
          detail: `${permit.permitNumber}: ${duration}, no final date. Contractor: ${contractor || "none returned"}. ${BBB_NOTE}`,
        },
      ];
    });

    const layerNote =
      input.permitStatus === "open"
        ? " These permits are San Jose's active permit layer. Permits on the expired layer are not included."
        : input.permitStatus === "all"
          ? " These permits are every San Jose roofing permit returned for this search."
          : "";
    const loadedLabel = searchLabel(input.radiusMiles);
    const countLabel = `${matches.length} open roofing permit${matches.length === 1 ? "" : "s"}`;
    const found =
      minimumYears === null
        ? `${countLabel} in this ${loadedLabel} ${matches.length === 1 ? "has" : "have"} no final date.`
        : `${countLabel} in this ${loadedLabel} ${matches.length === 1 ? "has" : "have"} been open at least ${minimumYears} ${minimumYears === 1 ? "year" : "years"}.`;
    const none =
      minimumYears === null
        ? `No returned permit in this ${loadedLabel} is open.`
        : `No open roofing permit in this ${loadedLabel} has been open at least ${minimumYears} ${minimumYears === 1 ? "year" : "years"}.`;

    return {
      answer: `${matches.length > 0 ? found : none}${radiusNote}${coverageNote}${layerNote} ${PERMIT_BASIS} ${BBB_NOTE}`,
      matches,
    };
  }

  const minimumYears = askedYears ?? 15;
  const loadedLabel = searchLabel(input.radiusMiles);
  const matches = input.parcels.flatMap((parcel) => {
    if (!meetsMinimumRoofAge(parcel.apn, minimumYears)) return [];

    return [
      {
        apn: parcel.apn,
        address: parcel.address || "Address unavailable",
        detail: `${roofAgeCardLabel(parcel.apn)}. ${BBB_NOTE}`,
      },
    ];
  });

  return {
    answer:
      matches.length > 0
        ? `${matches.length} ${matches.length === 1 ? "parcel has a" : "parcels have"} roof age of at least ${minimumYears} ${minimumYears === 1 ? "year" : "years"} in this ${loadedLabel}.${radiusNote}${coverageNote} ${ROOF_BASIS} ${BBB_NOTE}`
        : `No loaded parcel in this ${loadedLabel} has a roof age of at least ${minimumYears} ${minimumYears === 1 ? "year" : "years"}.${radiusNote}${coverageNote} ${ROOF_BASIS} ${BBB_NOTE}`,
    matches,
  };
}
