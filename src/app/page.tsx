import { readFileSync } from "node:fs";
import CrmDashboard from "@/components/CrmDashboard";
import { type RoofAgeSnapshotFile } from "@/lib/roofAgeProof";
import { ROOF_AGE_SNAPSHOT_PATH } from "@/lib/roofAgeSnapshotPath";

export default function Home() {
  const snapshot = JSON.parse(
    readFileSync(ROOF_AGE_SNAPSHOT_PATH, "utf8")
  ) as RoofAgeSnapshotFile;

  return <CrmDashboard roofAgeByApn={snapshot.parcels} />;
}
