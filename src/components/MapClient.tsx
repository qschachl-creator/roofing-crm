"use client";

import dynamic from "next/dynamic";

export type SearchCenter = {
  lat: number;
  lng: number;
};

export type ParcelMapPoint = {
  objectId: string;
  apn: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export type MapClientProps = {
  radiusMiles: number;
  searchCenter: SearchCenter | null;
  parcels: ParcelMapPoint[];
  selectedObjectId: string | null;
  onSearchCenterChange: (center: SearchCenter) => void;
  onParcelSelect: (objectId: string) => void;
};

const PropertyMap = dynamic<MapClientProps>(() => import("./PropertyMap"), {
  ssr: false,
  loading: () => <div style={{ padding: 24 }}>Loading map…</div>,
});

export default PropertyMap;
