"use client";

import dynamic from "next/dynamic";

export type SearchCenter = {
  lat: number;
  lng: number;
};

export type MapClientProps = {
  radiusMiles: number;
  searchCenter: SearchCenter | null;
  onSearchCenterChange: (center: SearchCenter) => void;
};

const PropertyMap = dynamic<MapClientProps>(() => import("./PropertyMap"), {
  ssr: false,
  loading: () => <div style={{ padding: 24 }}>Loading map…</div>,
});

export default PropertyMap;
