import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseSavedLeads,
  SAVED_LEADS_STORAGE_KEY,
} from "../src/lib/savedLeads.ts";

const dashboardSource = readFileSync(
  new URL("../src/components/CrmDashboard.tsx", import.meta.url),
  "utf8"
);

test("saved leads round-trip from browser storage", () => {
  assert.equal(SAVED_LEADS_STORAGE_KEY, "roofing-crm-saved-leads");

  const leads = parseSavedLeads(
    JSON.stringify([
      {
        objectId: "366283",
        apn: "67620085",
        address: "3350 KETTMANN RD, SAN JOSE CA 95121-1221",
        jurisdiction: "SAN JOSE",
      },
      { objectId: 1, apn: "bad" },
    ])
  );

  assert.deepEqual(leads, [
    {
      objectId: "366283",
      apn: "67620085",
      address: "3350 KETTMANN RD, SAN JOSE CA 95121-1221",
      jurisdiction: "SAN JOSE",
    },
  ]);
  assert.deepEqual(parseSavedLeads(null), []);
  assert.deepEqual(parseSavedLeads("not-json"), []);
  assert.deepEqual(parseSavedLeads(JSON.stringify({ apn: "67620085" })), []);
  assert.equal("permits" in leads[0], false);
  assert.equal("roofAgeSentence" in leads[0], false);
});

test("saved leads keep the permit record from save time", () => {
  const leads = parseSavedLeads(
    JSON.stringify([
      {
        objectId: "366283",
        apn: "67620085",
        address: "3350 KETTMANN RD, SAN JOSE CA 95121-1221",
        jurisdiction: "SAN JOSE",
        roofAgeSentence:
          "16 years old, replaced 2010-06-01, permit 2010-012446-RS",
        permits: [
          {
            permitNumber: "2010-012446-RS",
            status: "ISSUED",
            openDuration: "16.3 years since issue",
            contractor: "ROYAL KNIGHT ROOFING CO INC",
            longOpen: true,
          },
          { permitNumber: 12 },
        ],
      },
      {
        objectId: "1",
        apn: "00000000",
        address: "LEGACY ADDRESS",
        jurisdiction: null,
        permits: "not-a-list",
      },
    ])
  );

  assert.equal(leads.length, 2);
  assert.equal(
    leads[0].roofAgeSentence,
    "16 years old, replaced 2010-06-01, permit 2010-012446-RS"
  );
  assert.deepEqual(leads[0].permits, [
    {
      permitNumber: "2010-012446-RS",
      status: "ISSUED",
      openDuration: "16.3 years since issue",
      contractor: "ROYAL KNIGHT ROOFING CO INC",
      longOpen: true,
    },
  ]);
  assert.equal("permits" in leads[1], false);
  assert.equal("roofAgeSentence" in leads[1], false);
  assert.equal(leads[1].jurisdiction, null);

  assert.match(dashboardSource, /roofAgeSentence: roofAgeCardLabel\(parcel\.apn\)/);
  assert.match(dashboardSource, /permitNumber: detail\.permitNumber/);
  assert.match(dashboardSource, /status: detail\.status/);
  assert.match(dashboardSource, /openDuration: detail\.durationLabel/);
  assert.match(dashboardSource, /contractor: detail\.contractorLabel/);
  assert.match(dashboardSource, /parcelForSavedLead\(lead\)/);
  assert.match(dashboardSource, /selectParcel\(parcel\.objectId\)/);
  assert.match(dashboardSource, /\{permit\.permitNumber\}/);
  assert.match(dashboardSource, /\{permit\.contractor\}/);
});
