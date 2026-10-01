"use client";

import { useEffect, useMemo } from "react";
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
import type { LatLngExpression, LeafletMouseEvent, PathOptions } from "leaflet";
import L from "leaflet";
import type { MapClientProps, ParcelMapPoint, SearchCenter } from "./MapClient";

const SANTA_CLARA_CENTER: LatLngExpression = [37.35, -121.95];

const PARCEL_DOT_STYLE: PathOptions = {
  color: "#334155",
  fillColor: "#ffffff",
  fillOpacity: 0.9,
  weight: 2,
};

const RADIUS_STYLE: PathOptions = {
  color: "#111820",
  fillColor: "#111820",
  fillOpacity: 0.08,
  weight: 2,
};

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
  const latitude = searchCenter?.lat;
  const longitude = searchCenter?.lng;

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) {
      return;
    }

    map.flyTo([latitude, longitude], 13);
  }, [map, latitude, longitude]);

  return null;
}

function SearchOverlay({
  searchCenter,
  radiusMeters,
}: {
  searchCenter: SearchCenter;
  radiusMeters: number;
}) {
  const position = useMemo<LatLngExpression>(
    () => [searchCenter.lat, searchCenter.lng],
    [searchCenter.lat, searchCenter.lng]
  );

  return (
    <>
      <Marker position={position} icon={pinIcon} />
      <Circle
        center={position}
        radius={radiusMeters}
        pathOptions={RADIUS_STYLE}
      />
    </>
  );
}

function ParcelDot({ parcel }: { parcel: ParcelMapPoint }) {
  const latitude = parcel.latitude;
  const longitude = parcel.longitude;
  const position = useMemo<LatLngExpression | null>(() => {
    if (latitude === null || longitude === null) {
      return null;
    }

    return [latitude, longitude];
  }, [latitude, longitude]);

  if (!position) {
    return null;
  }

  return (
    <CircleMarker
      center={position}
      radius={5}
      pathOptions={PARCEL_DOT_STYLE}
    >
      <Tooltip>
        <strong>APN {parcel.apn}</strong>
        <br />
        {parcel.address || "Address unavailable"}
      </Tooltip>
    </CircleMarker>
  );
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
          <SearchOverlay
            searchCenter={searchCenter}
            radiusMeters={radiusMeters}
          />
        ) : null}

        {parcels.map((parcel) => (
          <ParcelDot key={parcel.objectId} parcel={parcel} />
        ))}
      </MapContainer>
    </div>
  );
}
