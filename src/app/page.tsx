import CrmDashboard from "@/components/CrmDashboard";
import { loadRoofAgeSnapshot } from "@/lib/loadRoofAgeSnapshot";
import { roofAgeRowsWithDates } from "@/lib/roofAgeProof";

export default async function Home() {
  const snapshot = await loadRoofAgeSnapshot();

  return (
    <CrmDashboard roofAgeByApn={roofAgeRowsWithDates(snapshot.parcels)} />
  );
}
