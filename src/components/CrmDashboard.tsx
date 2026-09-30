"use client";

import { useState } from "react";
import MapClient from "./MapClient";
import styles from "@/app/page.module.css";

type SearchCenter = {
  lat: number;
  lng: number;
};

type ParcelResult = {
  objectId: string;
  apn: string;
  address: string;
  jurisdiction: string | null;
  latitude: number | null;
  longitude: number | null;
  source: {
    datasetId: string;
    datasetUrl: string;
  };
};

type ParcelSearchResponse = {
  search: {
    latitude: number;
    longitude: number;
    radiusMiles: number;
  };
  count: number;
  truncatedAt: number;
  parcels: ParcelResult[];
  provenance: {
    source: string;
    datasetId: string;
    geometryFilter: string;
    note: string;
  };
};

type ErrorResponse = {
  error?: string;
};

export default function CrmDashboard() {
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [roofAge, setRoofAge] = useState(15);
  const [permitStatus, setPermitStatus] = useState("open");
  const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(null);
  const [parcels, setParcels] = useState<ParcelResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState(
    "Click the map or use your current location."
  );

  function updateSearchCenter(center: SearchCenter) {
    setSearchCenter(center);
    setParcels([]);
    setHasSearched(false);
    setSearchError(null);
    setLocationMessage(
      `Search center: ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
    );
  }

  function updateRadius(value: number) {
    setRadiusMiles(value);
    setParcels([]);
    setHasSearched(false);
    setSearchError(null);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation is not supported by this browser.");
      return;
    }

    setLocationMessage("Requesting your location…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateSearchCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationMessage("Search center set from your current location.");
      },
      () => {
        setLocationMessage(
          "Location permission was unavailable. You can still click the map."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  async function searchProperties() {
    if (!searchCenter) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams({
        lat: String(searchCenter.lat),
        lng: String(searchCenter.lng),
        radiusMiles: String(radiusMiles),
      });

      const response = await fetch(`/api/parcels/search?${params.toString()}`);
      const payload = (await response.json()) as
        | ParcelSearchResponse
        | ErrorResponse;

      if (!response.ok || !("parcels" in payload)) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Parcel search failed."
        );
      }

      setParcels(payload.parcels);
    } catch (error) {
      setParcels([]);
      setSearchError(
        error instanceof Error ? error.message : "Parcel search failed."
      );
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div>
          <p className={styles.eyebrow}>Prism Roofing</p>
          <h1>Lead Intelligence</h1>
          <p className={styles.subtle}>Santa Clara County, California</p>
        </div>

        <nav className={styles.nav} aria-label="Primary">
          <button className={styles.navActive}>Explore</button>
          <button>Leads</button>
          <button>Agent</button>
          <button disabled>Campaigns · Coming soon</button>
          <button disabled>Analytics · Coming soon</button>
        </nav>

        <div className={styles.sourceStatus}>
          <span className={styles.statusDot} />
          County GIS connected · Oracle enrichment pending
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Territory explorer</p>
            <h2>Find roofing opportunities</h2>
          </div>
          <button
            className={styles.secondaryButton}
            onClick={useCurrentLocation}
          >
            Use my location
          </button>
        </header>

        <section className={styles.controls} aria-label="Lead search controls">
          <label>
            Search radius
            <select
              value={radiusMiles}
              onChange={(event) => updateRadius(Number(event.target.value))}
            >
              <option value="1">1 mile</option>
              <option value="3">3 miles</option>
              <option value="5">5 miles</option>
              <option value="10">10 miles</option>
              <option value="25">25 miles</option>
            </select>
          </label>

          <label>
            Minimum roof age
            <select
              value={roofAge}
              onChange={(event) => setRoofAge(Number(event.target.value))}
            >
              <option value="10">10 years</option>
              <option value="15">15 years</option>
              <option value="20">20 years</option>
              <option value="25">25 years</option>
            </select>
          </label>

          <label>
            Permit status
            <select
              value={permitStatus}
              onChange={(event) => setPermitStatus(event.target.value)}
            >
              <option value="open">Open roofing permits</option>
              <option value="all">All roofing permits</option>
            </select>
          </label>

          <button
            className={styles.primaryButton}
            disabled={!searchCenter || isSearching}
            onClick={searchProperties}
          >
            {isSearching ? "Searching…" : "Search properties"}
          </button>
        </section>

        <div className={styles.dashboard}>
          <section className={styles.mapPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Map</p>
                <h3>Santa Clara County</h3>
              </div>
              <span className={styles.badge}>{radiusMiles}-mile radius</span>
            </div>

            <div className={styles.mapPlaceholder}>
              <MapClient
                radiusMiles={radiusMiles}
                searchCenter={searchCenter}
                parcels={parcels}
                onSearchCenterChange={updateSearchCenter}
              />
              <span>{locationMessage}</span>
            </div>
          </section>

          <aside className={styles.candidatesPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Geographic matches</p>
                <h3>Parcels in radius</h3>
              </div>
              <span className={styles.count}>{parcels.length}</span>
            </div>

            <p className={styles.candidateNotice}>
              County GIS determines geographic matches. Roof age and permit
              filters are not applied until Oracle and permit enrichment are
              connected.
            </p>

            {searchError ? (
              <div className={styles.emptyState}>
                <strong>Search unavailable</strong>
                <p>{searchError}</p>
              </div>
            ) : parcels.length > 0 ? (
              <div className={styles.candidateList}>
                {parcels.map((parcel) => (
                  <article className={styles.candidateCard} key={parcel.objectId}>
                    <div className={styles.candidateCardHeader}>
                      <strong>{parcel.address || "Address unavailable"}</strong>
                      <span>APN {parcel.apn}</span>
                    </div>
                    <p>
                      {parcel.jurisdiction || "Jurisdiction unavailable"} ·
                      OBJECTID {parcel.objectId}
                    </p>
                    <div className={styles.candidateMeta}>
                      <span>Roof age: pending enrichment</span>
                      <span>Permit status: pending enrichment</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>
                  {hasSearched ? "No parcels returned" : "No search results yet"}
                </strong>
                <p>
                  {hasSearched
                    ? "Try another search center or radius."
                    : "Choose a map location or use GPS, then search the county parcel dataset."}
                </p>
              </div>
            )}
          </aside>
        </div>

        <section className={styles.agentPanel}>
          <div>
            <p className={styles.eyebrow}>RAG agent</p>
            <h3>Ask about roofing opportunities</h3>
            <p className={styles.subtle}>
              Natural-language queries will retrieve matching property and
              permit records before generating an answer.
            </p>
          </div>

          <div className={styles.agentComposer}>
            <input
              aria-label="Ask the roofing intelligence agent"
              placeholder='e.g. "Show open roofing permits older than five years within five miles"'
              disabled
            />
            <button disabled>Ask</button>
          </div>

          <p className={styles.pendingNote}>
            Agent querying remains disabled until the retrieval layer is wired.
          </p>
        </section>
      </section>
    </main>
  );
}
