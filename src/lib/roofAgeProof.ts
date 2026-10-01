import path from "node:path";
import { fileURLToPath } from "node:url";

export const PENDING_ROOF_AGE_LABEL = "Roof age: pending source enrichment";

export const ROOF_AGE_SNAPSHOT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/san-jose-reroof-roof-age.json"
);

export type RoofAgeSnapshotRow = {
  parcel_identifier: string;
  builtYear: null;
  roof_date: string | null;
  roof_age_years: number | null;
  roof_age_source: "permit_updated" | "none";
  roof_age_confidence: "high" | "none";
  roof_age_permit_id: string | null;
  roof_age_eligibility_reason:
    | "accepted_completed_primary_roof_replacement"
    | "no_valid_anchor";
  olderThan15Years: boolean;
};

export type RoofAgeSnapshotFile = {
  parcels: Record<string, RoofAgeSnapshotRow>;
};

let roofAgeByUndashedApn: Readonly<Record<string, RoofAgeSnapshotRow>> = {};

export function undashedApn(apn: string) {
  return apn.replace(/-/g, "").trim();
}

export function installRoofAgeSnapshot(
  parcels: Record<string, RoofAgeSnapshotRow>
) {
  const next: Record<string, RoofAgeSnapshotRow> = {};

  for (const [key, row] of Object.entries(parcels)) {
    next[undashedApn(key)] = row;
  }

  roofAgeByUndashedApn = next;
}

export function roofAgeSnapshotRow(apn: string) {
  return roofAgeByUndashedApn[undashedApn(apn)];
}

function shown(value: string | number | null) {
  return value === null ? "null" : String(value);
}

export function roofAgeCardLabel(apn: string) {
  const proof = roofAgeSnapshotRow(apn);
  if (!proof) return PENDING_ROOF_AGE_LABEL;

  return [
    `Roof age: roof_date ${shown(proof.roof_date)}`,
    `roof_age_years ${shown(proof.roof_age_years)}`,
    `roof_age_source ${proof.roof_age_source}`,
    `roof_age_confidence ${proof.roof_age_confidence}`,
    `roof_age_permit_id ${shown(proof.roof_age_permit_id)}`,
    `roof_age_eligibility_reason ${proof.roof_age_eligibility_reason}`,
  ].join(" · ");
}

export function meetsMinimumRoofAge(apn: string, minimumYears: number) {
  const years = roofAgeSnapshotRow(apn)?.roof_age_years;
  return typeof years === "number" && years >= minimumYears;
}

export function parcelsMeetingMinimumRoofAge<T extends { apn: string }>(
  parcels: readonly T[],
  minimumYears: number
) {
  return parcels.filter((parcel) =>
    meetsMinimumRoofAge(parcel.apn, minimumYears)
  );
}
