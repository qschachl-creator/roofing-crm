export function permitAgeYears(issueDate: string | null, now = Date.now()) {
  if (!issueDate) return null;

  const issued = new Date(`${issueDate}T00:00:00Z`);
  if (Number.isNaN(issued.valueOf())) return null;

  return Math.max(
    0,
    (now - issued.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
}

export function isLongOpenPermit(finalDate: string | null, age: number | null) {
  return !finalDate && age !== null && age >= 5;
}

export function apnBatches(apns: readonly string[], size = 100) {
  const batches: string[][] = [];

  for (let index = 0; index < apns.length; index += size) {
    batches.push(apns.slice(index, index + size));
  }

  return batches;
}

type ListedPermit = {
  apn: string;
  finalDate?: string | null;
  issueDate?: string | null;
};

function permitMeetsOpenDuration(
  permit: ListedPermit,
  minimumOpenYears: number,
  now: number
) {
  const age = permitAgeYears(permit.issueDate ?? null, now);
  return !permit.finalDate && age !== null && age >= minimumOpenYears;
}

export function parcelsForPermitStatus<T extends { apn: string }>(
  roofAgeMatches: readonly T[],
  permits: readonly ListedPermit[],
  permitStatus: "open" | "all",
  radiusParcels: readonly T[] = roofAgeMatches,
  minimumOpenYears: number | null = null,
  now = Date.now()
) {
  const pool = permitStatus === "open" ? radiusParcels : roofAgeMatches;

  return pool.filter((parcel) => {
    const parcelPermits = permits.filter((permit) => permit.apn === parcel.apn);

    if (permitStatus === "open" && parcelPermits.length === 0) return false;
    if (minimumOpenYears === null) return true;

    return parcelPermits.some((permit) =>
      permitMeetsOpenDuration(permit, minimumOpenYears, now)
    );
  });
}

export function sortParcelsLongOpenFirst<T extends { apn: string }>(
  parcels: readonly T[],
  permits: readonly ListedPermit[],
  now = Date.now()
) {
  const longOpenApns = new Set(
    permits
      .filter((permit) =>
        isLongOpenPermit(
          permit.finalDate ?? null,
          permitAgeYears(permit.issueDate ?? null, now)
        )
      )
      .map((permit) => permit.apn)
  );

  return parcels
    .map((parcel, index) => ({
      parcel,
      index,
      rank: longOpenApns.has(parcel.apn) ? 0 : 1,
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.parcel);
}

export const BBB_RATING_UNAVAILABLE = "BBB rating unavailable";
export const NO_PERMIT_RETURNED =
  "No roofing permit was returned for this parcel.";
export const NO_CONTRACTOR_RETURNED = "No contractor was returned";

export type SelectedPermitSource = {
  permitNumber: string;
  status: string | null;
  layerName: string;
  issueDate: string | null;
  finalDate: string | null;
  contractorName: string | null;
};

export type SelectedPermitDetail = {
  permitNumber: string;
  status: string;
  yearsSinceIssue: number | null;
  durationLabel: string;
  longOpen: boolean;
  contractorLabel: string;
};

export type SelectedParcelPermitView = {
  permits: SelectedPermitDetail[];
  noPermitMessage: string | null;
  bbbRating: typeof BBB_RATING_UNAVAILABLE;
};

export function selectedParcelPermitView(
  permits: readonly SelectedPermitSource[],
  now = Date.now()
): SelectedParcelPermitView {
  if (permits.length === 0) {
    return {
      permits: [],
      noPermitMessage: NO_PERMIT_RETURNED,
      bbbRating: BBB_RATING_UNAVAILABLE,
    };
  }

  return {
    permits: permits.map((permit) => {
      const yearsSinceIssue = permitAgeYears(permit.issueDate, now);
      const contractor = permit.contractorName?.trim();

      return {
        permitNumber: permit.permitNumber,
        status:
          permit.status?.trim() || permit.layerName || "Status unavailable",
        yearsSinceIssue,
        durationLabel:
          yearsSinceIssue === null
            ? "Years since issue unavailable"
            : `${yearsSinceIssue.toFixed(1)} years since issue`,
        longOpen: isLongOpenPermit(permit.finalDate, yearsSinceIssue),
        contractorLabel: contractor ? contractor : NO_CONTRACTOR_RETURNED,
      };
    }),
    noPermitMessage: null,
    bbbRating: BBB_RATING_UNAVAILABLE,
  };
}
