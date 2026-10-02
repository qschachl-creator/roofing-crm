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

export function questionSearchPlace(question: string): QuestionPlace {
  const trimmed = question.trim();
  const cities = [...SANTA_CLARA_CITY_CENTERS].sort(
    (left, right) => right.name.length - left.name.length
  );

  for (const city of cities) {
    const pattern = new RegExp(
      `\\b${city.name.replace(/\s+/g, "\\s+")}\\b`,
      "i"
    );
    if (!pattern.test(trimmed)) continue;

    const askedMiles = askedRadiusMiles(trimmed);
    return {
      kind: "known",
      name: city.name,
      lat: city.lat,
      lng: city.lng,
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
    if (PLACE_STOP.has(name.split(/\s+/)[0].toLowerCase())) continue;
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
  const fromPhrase = firstQuantity(question, "miles");
  if (fromPhrase !== null) return fromPhrase;

  const singular = question.match(/\b(25|10|5|3|1)\s+mile\b/i);
  return singular ? Number(singular[1]) : null;
}

function firstQuantity(question: string, unit: string) {
  const digits = question.match(new RegExp(`(\\d+)\\s*${unit}`, "i"));
  if (digits) {
    const value = Number(digits[1]);
    return Number.isFinite(value) ? value : null;
  }

  const words = question.match(
    new RegExp(
      `(twenty-five|fifteen|twenty|ten|five|four|three|two|one)\\s+${unit}`,
      "i"
    )
  );
  if (!words) return null;

  return NUMBER_WORDS[words[1].toLowerCase()] ?? null;
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

  const askedMiles = firstQuantity(trimmed, "miles");
  const askedYears = firstQuantity(trimmed, "years");
  const asksOpenPermit = /open/i.test(trimmed) && /permit/i.test(trimmed);
  const asksRoof = /roof/i.test(trimmed) && !asksOpenPermit;
  const radiusNote =
    askedMiles !== null && askedMiles > input.radiusMiles
      ? ` The loaded search covers ${input.radiusMiles} miles, which is smaller than ${askedMiles} miles.`
      : "";

  if (!asksOpenPermit && !asksRoof) {
    return {
      answer: `Ask about roofs older than a number of years, or open roofing permits older than a number of years, inside this ${input.radiusMiles}-mile search. ${BBB_NOTE}`,
      matches: [],
    };
  }

  if (asksOpenPermit) {
    const minimumYears = askedYears ?? 5;

    if (input.permitError) {
      return {
        answer: `Permit records did not load for this search (${input.permitError}). ${BBB_NOTE}`,
        matches: [],
      };
    }

    const matches = input.permits.flatMap((permit) => {
      const age = permitAgeYears(permit.issueDate, input.now);
      const openLongEnough =
        !permit.finalDate && age !== null && age >= minimumYears;
      if (!openLongEnough) return [];

      const parcel = parcelForPermit(input.parcels, permit.apn);
      if (!parcel) return [];

      const contractor = permit.contractorName?.trim();

      return [
        {
          apn: parcel.apn,
          address: parcel.address || "Address unavailable",
          detail: `${permit.permitNumber}: ${age.toFixed(1)} years since issue, no final date. Contractor: ${contractor || "none returned"}. ${BBB_NOTE}`,
        },
      ];
    });

    return {
      answer:
        matches.length > 0
          ? `${matches.length} open roofing permit${matches.length === 1 ? "" : "s"} in this ${input.radiusMiles}-mile search ${matches.length === 1 ? "has" : "have"} been open at least ${minimumYears} years.${radiusNote} ${PERMIT_BASIS} ${BBB_NOTE}`
          : `No open roofing permit in this ${input.radiusMiles}-mile search has been open at least ${minimumYears} years.${radiusNote} ${PERMIT_BASIS} ${BBB_NOTE}`,
      matches,
    };
  }

  const minimumYears = askedYears ?? 15;
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
        ? `${matches.length} ${matches.length === 1 ? "parcel has a" : "parcels have"} roof age of at least ${minimumYears} years in this ${input.radiusMiles}-mile search.${radiusNote} ${ROOF_BASIS} ${BBB_NOTE}`
        : `No loaded parcel in this ${input.radiusMiles}-mile search has a roof age of at least ${minimumYears} years.${radiusNote} ${ROOF_BASIS} ${BBB_NOTE}`,
    matches,
  };
}
