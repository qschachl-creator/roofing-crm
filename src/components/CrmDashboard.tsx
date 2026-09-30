"use client";

import { useState } from "react";
import MapClient from "./MapClient";
import styles from "@/app/page.module.css";

type SearchCenter = {
  lat: number;
  lng: number;
};

export default function CrmDashboard() {
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [roofAge, setRoofAge] = useState(15);
  const [permitStatus, setPermitStatus] = useState("open");
  const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(null);
  const [locationMessage, setLocationMessage] = useState(
    "Click the map or use your current location."
  );

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation is not supported by this browser.");
      return;
    }

    setLocationMessage("Requesting your location…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchCenter({
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
          Oracle dataset connection pending
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
              onChange={(event) => setRadiusMiles(Number(event.target.value))}
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

          <button className={styles.primaryButton} disabled>
            Search properties
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
                onSearchCenterChange={setSearchCenter}
              />
              <span>{locationMessage}</span>
            </div>
          </section>

          <aside className={styles.candidatesPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Candidates</p>
                <h3>Roofing leads</h3>
              </div>
              <span className={styles.count}>0</span>
            </div>

            <div className={styles.emptyState}>
              <strong>No search results yet</strong>
              <p>
                Candidate properties will appear once the source-backed Oracle
                dataset is connected to these filters.
              </p>
              <p>
                Current filters: {roofAge}+ year roofs ·{" "}
                {permitStatus === "open" ? "open permits" : "all permits"}
              </p>
            </div>
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
