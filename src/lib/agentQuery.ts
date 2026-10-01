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
          ? `${matches.length} open roofing permit${matches.length === 1 ? "" : "s"} in this ${input.radiusMiles}-mile search ${matches.length === 1 ? "has" : "have"} been open at least ${minimumYears} years.${radiusNote} ${BBB_NOTE}`
          : `No open roofing permit in this ${input.radiusMiles}-mile search has been open at least ${minimumYears} years.${radiusNote} ${BBB_NOTE}`,
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
        ? `${matches.length} ${matches.length === 1 ? "parcel has a" : "parcels have"} roof age of at least ${minimumYears} years in this ${input.radiusMiles}-mile search.${radiusNote} ${BBB_NOTE}`
        : `No loaded parcel in this ${input.radiusMiles}-mile search has a roof age of at least ${minimumYears} years.${radiusNote} ${BBB_NOTE}`,
    matches,
  };
}
