import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSavedLeads,
  SAVED_LEADS_STORAGE_KEY,
} from "../src/lib/savedLeads.ts";

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
});
