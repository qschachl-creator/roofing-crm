"use client";

import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLngExpression, LeafletMouseEvent } from "leaflet";
import L from "leaflet";
import type { MapClientProps, SearchCenter } from "./MapClient";

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
      box-shadow: 0 2px 8px rgba(0,0,0,.28);
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

function RecenterMap({
  searchCenter,
}: {
  searchCenter: SearchCenter | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (searchCenter) {
      map.flyTo([searchCenter.lat, searchCenter.lng], 13);
    }
  }, [map, searchCenter]);

  return null;
}

export default function PropertyMap({
  radiusMiles,
  searchCenter,
  parcels,
  onSearchCenterChange,
}: MapClientProps) {
  const radiusMeters = radiusMiles * 1609.344;

  return (
    <div
      style={{
        height: "390px",
        width: "100%",
        overflow: "hidden",
        borderRadius: "10px",
      }}
    >
      <MapContainer
        center={SANTA_CLARA_CENTER}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <PinController onPin={onSearchCenterChange} />
        <RecenterMap searchCenter={searchCenter} />

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

        {parcels.map((parcel) => {
          if (parcel.latitude === null || parcel.longitude === null) {
            return null;
          }

          return (
            <CircleMarker
              key={parcel.objectId}
              center={[parcel.latitude, parcel.longitude]}
              radius={5}
              pathOptions={{
                color: "#334155",
                fillColor: "#ffffff",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Tooltip>
                <strong>APN {parcel.apn}</strong>
                <br />
                {parcel.address || "Address unavailable"}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
