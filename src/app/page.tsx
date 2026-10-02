import CrmDashboard from "@/components/CrmDashboard";
import { loadRoofAgeSnapshot } from "@/lib/loadRoofAgeSnapshot";

export default async function Home() {
  const snapshot = await loadRoofAgeSnapshot();

  return <CrmDashboard roofAgeByApn={snapshot.parcels} />;
}
