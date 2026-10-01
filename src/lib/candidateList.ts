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
