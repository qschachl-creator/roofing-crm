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

export function parcelsForPermitStatus<T extends { apn: string }>(
  roofAgeMatches: readonly T[],
  permits: readonly { apn: string }[],
  permitStatus: "open" | "all"
) {
  if (permitStatus === "all") return roofAgeMatches;

  return roofAgeMatches.filter((parcel) =>
    permits.some((permit) => permit.apn === parcel.apn)
  );
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
