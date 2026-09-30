"use client";

import { useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import type { LatLngExpression, LeafletMouseEvent } from "leaflet";
import L from "leaflet";

type SearchCenter = {
  lat: number;
  lng: number;
};

const SANTA_CLARA_CENTER: LatLngExpression = [37.35, -121.95];

const pinIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: #111820;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,.28);
    "></div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function PinController({
  onPin,
}: {
  onPin: (center: SearchCenter) => void;
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onPin({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  return null;
}

export default function PropertyMap() {
  const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(null);
  const [radiusMiles] = useState(5);

  const radiusMeters = radiusMiles * 1609.344;

  return (
    <div style={{ height: "390px", width: "100%", overflow: "hidden", borderRadius: "10px" }}>
      <MapContainer
        center={SANTA_CLARA_CENTER}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <PinController onPin={setSearchCenter} />

        {searchCenter ? (
          <>
            <Marker
              position={[searchCenter.lat, searchCenter.lng]}
              icon={pinIcon}
            />
            <Circle
              center={[searchCenter.lat, searchCenter.lng]}
              radius={radiusMeters}
              pathOptions={{
                color: "#111820",
                fillColor: "#111820",
                fillOpacity: 0.08,
                weight: 2,
              }}
            />
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}
