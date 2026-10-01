import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isLongOpenPermit,
  parcelsForPermitStatus,
  permitAgeYears,
} from "../src/lib/candidateList.ts";
import {
  installRoofAgeSnapshot,
  meetsMinimumRoofAge,
  parcelsMeetingMinimumRoofAge,
  roofAgeCardLabel,
} from "../src/lib/roofAgeProof.ts";
import { ROOF_AGE_SNAPSHOT_PATH } from "../src/lib/roofAgeSnapshotPath.ts";

const dashboardSource = readFileSync(
  new URL("../src/components/CrmDashboard.tsx", import.meta.url),
  "utf8"
);
const candidateListSource = readFileSync(
  new URL("../src/lib/candidateList.ts", import.meta.url),
  "utf8"
);
const snapshot = JSON.parse(readFileSync(ROOF_AGE_SNAPSHOT_PATH, "utf8"));
installRoofAgeSnapshot(snapshot.parcels);

const NOW = Date.parse("2026-10-01T00:00:00Z");

function permitRow(apn, issueDate, finalDate) {
  return {
    apn,
    permitNumber: `${apn}-${issueDate ?? "none"}`,
    description: "Reroof",
    status: "ISSUED",
    issueDate,
    finalDate,
    contractorName: "SOURCE CONTRACTOR",
    applicantName: null,
    address: null,
    estimatedValue: null,
    layerId: 8,
    layerName: "Active Building Permit",
    sourceUrl: "https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_PermitsAndComplaints/MapServer/8",
  };
}

test("open permit status drops permit-less roof-age parcels and all keeps them", () => {
  const aged = Object.entries(snapshot.parcels)
    .filter(
      ([, row]) =>
        typeof row.roof_age_years === "number" && row.roof_age_years >= 15
    )
    .map(([apn]) => apn);
  const withoutPermit = aged.find((apn) => apn !== "67620085");

  assert.ok(aged.includes("67620085"));
  assert.ok(withoutPermit);

  const parcels = [
    { apn: "67620085", address: "old roof with permit" },
    { apn: "09241022", address: "new roof with permit" },
    { apn: withoutPermit, address: "old roof without permit" },
    { apn: "68958007", address: "no anchor with permit" },
  ];
  const permits = [
    permitRow("67620085", "2018-06-01", null),
    permitRow("09241022", "2026-01-01", null),
    permitRow("68958007", "2015-01-01", null),
  ];

  const roofAgeMatches = parcelsMeetingMinimumRoofAge(parcels, 15);
  const openListed = parcelsForPermitStatus(
    roofAgeMatches,
    permits,
    "open"
  );
  const allListed = parcelsForPermitStatus(roofAgeMatches, permits, "all");

  assert.deepEqual(
    openListed.map((parcel) => parcel.apn),
    ["67620085"]
  );
  assert.deepEqual(
    allListed.map((parcel) => parcel.apn),
    ["67620085", withoutPermit]
  );
  assert.equal(
    openListed.some((parcel) => parcel.apn === withoutPermit),
    false
  );
  assert.equal(meetsMinimumRoofAge("67620085", 15), true);
  assert.equal(meetsMinimumRoofAge("09241022", 15), false);
  assert.equal(meetsMinimumRoofAge("68958007", 15), false);
  assert.equal(
    snapshot.parcels["68958007"].roof_age_eligibility_reason,
    "no_valid_anchor"
  );
  assert.match(roofAgeCardLabel("68958007"), /no_valid_anchor/);
  assert.match(
    dashboardSource,
    /parcelsMeetingMinimumRoofAge\(parcels, roofAge\)/
  );
  assert.match(
    dashboardSource,
    /parcelsForPermitStatus\(\s*roofAgeMatches,\s*roofingPermits,\s*permitStatus\s*\)/
  );
});

test("long-open emphasis uses a final date and an issue age of at least five years", () => {
  const oldOpen = permitRow("67620085", "2018-06-01", null);
  const oldAge = permitAgeYears(oldOpen.issueDate, NOW);
  const recentOpen = permitRow("67620085", "2024-06-01", null);
  const recentAge = permitAgeYears(recentOpen.issueDate, NOW);
  const closed = permitRow("67620085", "2018-06-01", "2019-01-01");
  const closedAge = permitAgeYears(closed.issueDate, NOW);

  assert.equal(oldAge !== null && oldAge >= 5, true);
  assert.equal(recentAge !== null && recentAge < 5, true);
  assert.equal(isLongOpenPermit(oldOpen.finalDate, oldAge), true);
  assert.equal(isLongOpenPermit(recentOpen.finalDate, recentAge), false);
  assert.equal(isLongOpenPermit(closed.finalDate, closedAge), false);
  assert.equal(isLongOpenPermit(null, 5), true);
  assert.equal(isLongOpenPermit(null, 4.9), false);
  assert.equal(isLongOpenPermit(null, null), false);
  assert.equal(permitAgeYears(null, NOW), null);
  assert.match(
    candidateListSource,
    /!finalDate && age !== null && age >= 5/
  );
  assert.match(dashboardSource, /isLongOpenPermit\(permit\.finalDate, age\)/);
  assert.match(dashboardSource, /styles\.longOpen/);
  assert.match(dashboardSource, />\s*Long-open\s*</);
  assert.match(dashboardSource, /styles\.candidateCardLongOpen/);
});

test("permit search contract stays apns and open or all", () => {
  assert.match(
    dashboardSource,
    /JSON\.stringify\(\{\s*apns:\s*sanJoseApns,\s*permitStatus,\s*\}\)/
  );

  const select = dashboardSource.match(/Permit status[\s\S]*?<\/select>/);
  assert.ok(select);
  const options = [...select[0].matchAll(/<option value="([^"]+)"/g)].map(
    (entry) => entry[1]
  );
  assert.deepEqual(options, ["open", "all"]);

  const parcelParams = dashboardSource.match(
    /new URLSearchParams\(\{([\s\S]*?)\}\)/
  );
  assert.ok(parcelParams);
  const parcelKeys = [
    ...parcelParams[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm),
  ].map((entry) => entry[1]);
  assert.deepEqual(parcelKeys, ["lat", "lng", "radiusMiles"]);
  assert.match(
    dashboardSource,
    /The list was narrowed by the permit filter/
  );
});
