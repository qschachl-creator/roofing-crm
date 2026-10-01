import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SANTA_CLARA_CITY_CENTERS,
  answerRoofingQuestion,
  questionSearchPlace,
} from "../src/lib/agentQuery.ts";
import { installRoofAgeSnapshot } from "../src/lib/roofAgeProof.ts";

const dashboardSource = readFileSync(
  new URL("../src/components/CrmDashboard.tsx", import.meta.url),
  "utf8"
);

installRoofAgeSnapshot({
  "67620085": {
    parcel_identifier: "67620085",
    builtYear: null,
    roof_date: "2010-06-01",
    roof_age_years: 16,
    roof_age_source: "permit_updated",
    roof_age_confidence: "high",
    roof_age_permit_id: "2010-012446-RS",
    roof_age_eligibility_reason: "accepted_completed_primary_roof_replacement",
    olderThan15Years: true,
  },
  "09241022": {
    parcel_identifier: "09241022",
    builtYear: null,
    roof_date: "2026-09-12",
    roof_age_years: 0,
    roof_age_source: "permit_updated",
    roof_age_confidence: "high",
    roof_age_permit_id: "2026-135571-RS",
    roof_age_eligibility_reason: "accepted_completed_primary_roof_replacement",
    olderThan15Years: false,
  },
});

const parcels = [
  { apn: "67620085", address: "3350 Kettmann Rd" },
  { apn: "09241022", address: "492 Edelweiss Dr" },
];

const permits = [
  {
    apn: "67620085",
    permitNumber: "1997-000001-RS",
    issueDate: "2010-06-01",
    finalDate: null,
    contractorName: "ROYAL KNIGHT ROOFING CO INC",
  },
  {
    apn: "09241022",
    permitNumber: "2024-000002-RS",
    issueDate: "2024-01-01",
    finalDate: "2024-06-01",
    contractorName: "CLOSED ROOFING",
  },
];

const NOW = Date.parse("2026-10-01T00:00:00Z");

test("agent requires a radius search before answering", () => {
  const answer = answerRoofingQuestion(
    "Show open roofing permits older than five years within five miles",
    {
      parcels,
      permits,
      radiusMiles: null,
      hasSearched: false,
      now: NOW,
    }
  );

  assert.equal(answer.matches.length, 0);
  assert.match(answer.answer, /Search a map radius first/);
});

test("agent lists open permits older than five years in the loaded search", () => {
  const answer = answerRoofingQuestion(
    "Show open roofing permits older than five years within five miles",
    {
      parcels,
      permits,
      radiusMiles: 5,
      hasSearched: true,
      now: NOW,
    }
  );

  assert.equal(answer.matches.length, 1);
  assert.equal(answer.matches[0].apn, "67620085");
  assert.match(answer.matches[0].detail, /ROYAL KNIGHT ROOFING CO INC/);
  assert.match(answer.answer, /BBB rating is unavailable/);
  assert.equal(answer.answer.includes("smaller than 5 miles"), false);
});

test("agent lists roofs at least 15 years old and notes a larger asked radius", () => {
  const answer = answerRoofingQuestion(
    "Which properties within ten miles have roofs older than 15 years?",
    {
      parcels,
      permits,
      radiusMiles: 5,
      hasSearched: true,
      now: NOW,
    }
  );

  assert.deepEqual(
    answer.matches.map((match) => match.apn),
    ["67620085"]
  );
  assert.match(answer.answer, /smaller than 10 miles/);
  assert.match(answer.matches[0].detail, /roof_age_years 16/);
});

test("a known city resolves to coordinates and an unknown city does not", () => {
  const sanJose = SANTA_CLARA_CITY_CENTERS.find(
    (city) => city.name === "San Jose"
  );
  assert.ok(sanJose);

  const place = questionSearchPlace(
    "Show open roofing permits older than five years within five miles of San Jose"
  );
  assert.equal(place.kind, "known");
  if (place.kind !== "known") return;
  assert.equal(place.name, "San Jose");
  assert.equal(place.lat, sanJose.lat);
  assert.equal(place.lng, sanJose.lng);
  assert.equal(place.radiusMiles, 5);
  assert.equal(Number.isFinite(place.lat), true);
  assert.equal(Number.isFinite(place.lng), true);

  for (const city of SANTA_CLARA_CITY_CENTERS) {
    const resolved = questionSearchPlace(`roofs near ${city.name}`);
    assert.equal(resolved.kind, "known");
    if (resolved.kind !== "known") continue;
    assert.equal(resolved.lat, city.lat);
    assert.equal(resolved.lng, city.lng);
  }

  const unknown = questionSearchPlace(
    "Show open roofing permits older than five years within five miles of Oakland"
  );
  assert.equal(unknown.kind, "unknown");
  if (unknown.kind !== "unknown") return;
  assert.equal(unknown.name, "Oakland");
  assert.equal("lat" in unknown, false);
  assert.equal("lng" in unknown, false);

  const unnamed = questionSearchPlace(
    "Show open roofing permits older than five years within five miles"
  );
  assert.equal(unnamed.kind, "none");

  const refused = answerRoofingQuestion(
    "Show open roofing permits older than five years within five miles of Oakland",
    {
      parcels,
      permits,
      radiusMiles: null,
      hasSearched: false,
      now: NOW,
    }
  );
  assert.equal(refused.matches.length, 0);
  assert.match(refused.answer, /Oakland is not in the Santa Clara County city list/);
  assert.match(refused.answer, /no search was run/);
  assert.equal(refused.answer.includes("Search a map radius first"), false);

  assert.match(dashboardSource, /questionSearchPlace\(agentQuestion\)/);
  assert.match(dashboardSource, /place\.kind === "known"/);
  assert.match(dashboardSource, /lat: place\.lat/);
  assert.match(dashboardSource, /lng: place\.lng/);
  assert.match(dashboardSource, /searchProperties\(center, miles\)/);
});
