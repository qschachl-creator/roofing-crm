import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ROOF_AGE_SNAPSHOT_PATH,
  installRoofAgeSnapshot,
  meetsMinimumRoofAge,
  parcelsMeetingMinimumRoofAge,
  roofAgeCardLabel,
} from "../src/lib/roofAgeProof.ts";

const PENDING = "Roof age: pending source enrichment";
const dashboardSource = readFileSync(
  new URL("../src/components/CrmDashboard.tsx", import.meta.url),
  "utf8"
);
const snapshot = JSON.parse(readFileSync(ROOF_AGE_SNAPSHOT_PATH, "utf8"));
installRoofAgeSnapshot(snapshot.parcels);

function labelFromSnapshotRow(row) {
  const shown = (value) => (value === null ? "null" : String(value));
  return [
    `Roof age: roof_date ${shown(row.roof_date)}`,
    `roof_age_years ${shown(row.roof_age_years)}`,
    `roof_age_source ${row.roof_age_source}`,
    `roof_age_confidence ${row.roof_age_confidence}`,
    `roof_age_permit_id ${shown(row.roof_age_permit_id)}`,
    `roof_age_eligibility_reason ${row.roof_age_eligibility_reason}`,
  ].join(" · ");
}

test("three proven APNs render Oracle roof-age fields", () => {
  const recent = roofAgeCardLabel("09241022");
  assert.equal(
    recent,
    "Roof age: roof_date 2026-09-12 · roof_age_years 0 · roof_age_source permit_updated · roof_age_confidence high · roof_age_permit_id 2026-135571-RS · roof_age_eligibility_reason accepted_completed_primary_roof_replacement"
  );

  const unanchored = roofAgeCardLabel("68958007");
  assert.equal(
    unanchored,
    "Roof age: roof_date null · roof_age_years null · roof_age_source none · roof_age_confidence none · roof_age_permit_id null · roof_age_eligibility_reason no_valid_anchor"
  );
  assert.equal(unanchored.includes("1997-10-22"), false);
  assert.equal(unanchored.includes("1997"), false);

  const older = roofAgeCardLabel("67620085");
  assert.equal(
    older,
    "Roof age: roof_date 2010-06-01 · roof_age_years 16 · roof_age_source permit_updated · roof_age_confidence high · roof_age_permit_id 2010-012446-RS · roof_age_eligibility_reason accepted_completed_primary_roof_replacement"
  );

  assert.match(dashboardSource, /\{roofAgeCardLabel\(parcel\.apn\)\}/);
});

test("any other APN keeps the pending roof-age message", () => {
  assert.equal(roofAgeCardLabel("00000000"), PENDING);
  assert.equal(roofAgeCardLabel("09241023"), PENDING);
  assert.equal(roofAgeCardLabel(""), PENDING);
});

test("parcel search params are only lat, lng, and radiusMiles", () => {
  const match = dashboardSource.match(/new URLSearchParams\(\{([\s\S]*?)\}\)/);
  assert.ok(match);
  const keys = [...match[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map(
    (entry) => entry[1]
  );
  assert.deepEqual(keys, ["lat", "lng", "radiusMiles"]);
  assert.equal(keys.includes("roofAge"), false);
});

test("oracle roof-age snapshot has the published census", () => {
  const rows = Object.values(snapshot.parcels);

  assert.equal(Object.keys(snapshot.parcels).length, 6955);
  assert.equal(
    rows.filter(
      (row) =>
        row.roof_age_eligibility_reason ===
        "accepted_completed_primary_roof_replacement"
    ).length,
    59
  );
  assert.equal(rows.filter((row) => row.olderThan15Years).length, 5);
  assert.equal(
    rows.every((row) => row.builtYear === null),
    true
  );

  assert.equal(
    roofAgeCardLabel("67620085"),
    labelFromSnapshotRow(snapshot.parcels["67620085"])
  );
  assert.equal(
    roofAgeCardLabel("09241022"),
    labelFromSnapshotRow(snapshot.parcels["09241022"])
  );
  assert.equal(
    roofAgeCardLabel("68958007"),
    labelFromSnapshotRow(snapshot.parcels["68958007"])
  );
  assert.equal(
    snapshot.parcels["68958007"].roof_age_eligibility_reason,
    "no_valid_anchor"
  );
  assert.equal(snapshot.parcels["68958007"].roof_date, null);
  assert.equal(snapshot.parcels["68958007"].roof_age_permit_id, null);
  assert.equal(snapshot.parcels["67620085"].roof_age_years, 16);
  assert.equal(snapshot.parcels["09241022"].roof_age_years, 0);
});

test("minimum roof age 15 lists only snapshot ages of at least 15", () => {
  const radiusParcels = [
    { apn: "67620085", address: "older roof" },
    { apn: "09241022", address: "new roof" },
    { apn: "68958007", address: "no anchor" },
    { apn: "00000000", address: "absent from snapshot" },
  ];

  const listed = parcelsMeetingMinimumRoofAge(radiusParcels, 15);

  assert.deepEqual(
    listed.map((parcel) => parcel.apn),
    ["67620085"]
  );
  assert.equal(meetsMinimumRoofAge("67620085", 15), true);
  assert.equal(meetsMinimumRoofAge("676-20-085", 15), true);
  assert.equal(meetsMinimumRoofAge("09241022", 15), false);
  assert.equal(meetsMinimumRoofAge("68958007", 15), false);
  assert.equal(meetsMinimumRoofAge("00000000", 15), false);
  assert.match(
    dashboardSource,
    /parcelsMeetingMinimumRoofAge\(parcels, roofAge\)/
  );
});
