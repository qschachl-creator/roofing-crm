"use client";

import { useState, useSyncExternalStore } from "react";
import MapClient from "./MapClient";
import styles from "@/app/page.module.css";
import {
  answerRoofingQuestion,
  questionSearchPlace,
} from "@/lib/agentQuery";
import {
  apnBatches,
  parcelsForPermitStatus,
  selectedParcelPermitView,
  sortParcelsLongOpenFirst,
} from "@/lib/candidateList";
import {
  installRoofAgeSnapshot,
  parcelsMeetingMinimumRoofAge,
  roofAgeCardLabel,
  roofAgeSourceLabel,
  undashedApn,
  type RoofAgeSnapshotRow,
} from "@/lib/roofAgeProof";
import {
  readSavedLeads,
  savedLeadsServerSnapshot,
  subscribeSavedLeads,
  writeSavedLeads,
  type SavedLead,
} from "@/lib/savedLeads";

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
  truncated: boolean;
  pageLimit: number;
  truncatedAt: number;
  parcels: ParcelResult[];
  provenance: {
    source: string;
    datasetId: string;
    geometryFilter: string;
    note: string;
  };
};

type RoofingPermit = {
  apn: string;
  permitNumber: string;
  description: string | null;
  status: string | null;
  issueDate: string | null;
  finalDate: string | null;
  contractorName: string | null;
  applicantName: string | null;
  address: string | null;
  estimatedValue: number | null;
  layerId: number;
  layerName: string;
  sourceUrl: string;
};

type PermitSearchResponse = {
  count: number;
  permits: RoofingPermit[];
};

type ErrorResponse = {
  error?: string;
};

export default function CrmDashboard({
  roofAgeByApn,
}: {
  roofAgeByApn: Record<string, RoofAgeSnapshotRow>;
}) {
  const [activeSection, setActiveSection] = useState<
    "explore" | "leads" | "agent"
  >("explore");
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [roofAge, setRoofAge] = useState(15);
  const [permitStatus, setPermitStatus] = useState<"open" | "all">("open");
  const [minimumOpenYears, setMinimumOpenYears] = useState<number | null>(
    null
  );
  const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(null);
  const [parcels, setParcels] = useState<ParcelResult[]>([]);
  const [roofingPermits, setRoofingPermits] = useState<RoofingPermit[]>([]);
  const [permitError, setPermitError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const leads = useSyncExternalStore(
    subscribeSavedLeads,
    readSavedLeads,
    savedLeadsServerSnapshot
  );
  const [mapTruncated, setMapTruncated] = useState(false);
  const [mapPageLimit, setMapPageLimit] = useState(500);
  const [agentQuestion, setAgentQuestion] = useState("");
  const [agentAnswer, setAgentAnswer] = useState<ReturnType<
    typeof answerRoofingQuestion
  > | null>(null);
  const [locationMessage, setLocationMessage] = useState(
    "Click the map or use your current location."
  );
  installRoofAgeSnapshot(roofAgeByApn);
  const roofAgeMatches = parcelsMeetingMinimumRoofAge(parcels, roofAge);
  const permitListed = parcelsForPermitStatus(
    roofAgeMatches,
    roofingPermits,
    permitStatus,
    parcels,
    minimumOpenYears
  );
  const listedBeforeDuration = parcelsForPermitStatus(
    roofAgeMatches,
    roofingPermits,
    permitStatus,
    parcels,
    null
  );
  const listedParcels = sortParcelsLongOpenFirst(
    permitListed,
    roofingPermits
  );
  const narrowedByOpenPermits =
    hasSearched &&
    permitStatus === "open" &&
    minimumOpenYears === null &&
    roofAgeMatches.length > 0 &&
    permitListed.length === 0;
  const narrowedByDuration =
    hasSearched &&
    minimumOpenYears !== null &&
    listedBeforeDuration.length > 0 &&
    permitListed.length === 0;
  const selectedParcel = selectedObjectId
    ? (parcels.find((parcel) => parcel.objectId === selectedObjectId) ?? null)
    : null;

  function navigateToSection(section: "explore" | "leads" | "agent") {
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function selectParcel(objectId: string) {
    setSelectedObjectId(objectId);
    setActiveSection("explore");
  }

  function resetPin() {
    setSearchCenter(null);
    setParcels([]);
    setRoofingPermits([]);
    setPermitError(null);
    setHasSearched(false);
    setSearchError(null);
    setSelectedObjectId(null);
    setMapTruncated(false);
    setAgentAnswer(null);
    setLocationMessage("Click the map or use your current location.");
  }

  function updateSearchCenter(center: SearchCenter) {
    setSearchCenter(center);
    setParcels([]);
    setRoofingPermits([]);
    setPermitError(null);
    setHasSearched(false);
    setSearchError(null);
    setSelectedObjectId(null);
    setMapTruncated(false);
    setLocationMessage(
      `Search center: ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
    );
  }

  function updateRadius(value: number) {
    setRadiusMiles(value);
    setParcels([]);
    setRoofingPermits([]);
    setPermitError(null);
    setHasSearched(false);
    setSearchError(null);
    setSelectedObjectId(null);
    setMapTruncated(false);
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

  function sanJoseApnsFrom(results: readonly ParcelResult[]) {
    return results
      .filter(
        (parcel) => parcel.jurisdiction?.trim().toUpperCase() === "SAN JOSE"
      )
      .map((parcel) => parcel.apn);
  }

  async function loadPermits(apns: string[], status: "open" | "all") {
    if (apns.length === 0) {
      setRoofingPermits([]);
      setPermitError(null);
      return { permits: [] as RoofingPermit[], error: null as string | null };
    }

    try {
      const batches = await Promise.all(
        apnBatches(apns).map(async (batch) => {
          const permitResponse = await fetch("/api/permits/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              apns: batch,
              permitStatus: status,
            }),
          });
          const permitPayload = (await permitResponse.json()) as
            | PermitSearchResponse
            | ErrorResponse;

          if (!permitResponse.ok || !("permits" in permitPayload)) {
            throw new Error(
              "error" in permitPayload && permitPayload.error
                ? permitPayload.error
                : "Permit enrichment failed."
            );
          }

          return permitPayload.permits;
        })
      );

      const permits = batches.flat();
      setRoofingPermits(permits);
      setPermitError(null);
      return { permits, error: null as string | null };
    } catch (permitFailure) {
      const message =
        permitFailure instanceof Error
          ? permitFailure.message
          : "Permit enrichment failed.";
      setRoofingPermits([]);
      setPermitError(message);
      return { permits: [] as RoofingPermit[], error: message };
    }
  }

  function updatePermitStatus(status: "open" | "all") {
    setPermitStatus(status);
    setSelectedObjectId(null);
    if (!hasSearched) return;
    void loadPermits(sanJoseApnsFrom(parcels), status);
  }

  function parcelByObjectId(objectId: string) {
    return parcels.find((parcel) => parcel.objectId === objectId) ?? null;
  }

  function parcelByApn(apn: string) {
    const key = undashedApn(apn);
    return parcels.find((parcel) => undashedApn(parcel.apn) === key) ?? null;
  }

  function parcelForSavedLead(lead: SavedLead) {
    return parcelByObjectId(lead.objectId) ?? parcelByApn(lead.apn);
  }

  function saveLead(parcel: ParcelResult) {
    if (leads.some((lead) => lead.apn === parcel.apn)) {
      setActiveSection("leads");
      return;
    }

    const permitView = selectedParcelPermitView(
      roofingPermits.filter((permit) => permit.apn === parcel.apn)
    );

    writeSavedLeads([
      ...leads,
      {
        objectId: parcel.objectId,
        apn: parcel.apn,
        address: parcel.address,
        jurisdiction: parcel.jurisdiction,
        roofAgeSentence: roofAgeCardLabel(parcel.apn),
        permits: permitView.permits.map((detail) => ({
          permitNumber: detail.permitNumber,
          status: detail.status,
          openDuration: detail.durationLabel,
          contractor: detail.contractorLabel,
          longOpen: detail.longOpen,
        })),
      },
    ]);
    setActiveSection("leads");
  }

  async function askAgent() {
    const place = questionSearchPlace(agentQuestion);
    setActiveSection("agent");

    if (place.kind === "known") {
      const miles = place.radiusMiles ?? radiusMiles;
      const center = { lat: place.lat, lng: place.lng };
      setSearchCenter(center);
      setRadiusMiles(miles);
      setLocationMessage(
        `Search center: ${place.name} · ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
      );
      const loaded = await searchProperties(center, miles);
      if (!loaded.ok) {
        setAgentAnswer({
          answer: loaded.error ?? "Parcel search failed.",
          matches: [],
        });
        return;
      }

      setAgentAnswer(
        answerRoofingQuestion(agentQuestion, {
          parcels: loaded.parcels,
          permits: loaded.permits,
          radiusMiles: miles,
          hasSearched: true,
          permitError: loaded.permitError,
          permitStatus,
          truncated: loaded.truncated,
        })
      );
      return;
    }

    setAgentAnswer(
      answerRoofingQuestion(agentQuestion, {
        parcels,
        permits: roofingPermits,
        radiusMiles: hasSearched ? radiusMiles : null,
        hasSearched,
        permitError,
        permitStatus,
        truncated: mapTruncated,
      })
    );
  }

  async function searchProperties(
    center: SearchCenter | null = searchCenter,
    miles = radiusMiles
  ) {
    if (!center) {
      return {
        ok: false,
        error:
          "Choose a map location or use GPS, then search the county parcel dataset.",
        parcels: [] as ParcelResult[],
        permits: [] as RoofingPermit[],
        permitError: null as string | null,
        truncated: false,
      };
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setPermitError(null);
    setRoofingPermits([]);
    setSelectedObjectId(null);

    try {
      const params = new URLSearchParams({
        lat: String(center.lat),
        lng: String(center.lng),
        radiusMiles: String(miles),
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
      setMapTruncated(payload.truncated);
      setMapPageLimit(payload.pageLimit);
      const loadedPermits = await loadPermits(
        sanJoseApnsFrom(payload.parcels),
        permitStatus
      );
      return {
        ok: true,
        error: null,
        parcels: payload.parcels,
        permits: loadedPermits.permits,
        permitError: loadedPermits.error,
        truncated: payload.truncated,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Parcel search failed.";
      setParcels([]);
      setMapTruncated(false);
      setSearchError(message);
      return {
        ok: false,
        error: message,
        parcels: [] as ParcelResult[],
        permits: [] as RoofingPermit[],
        permitError: null as string | null,
        truncated: false,
      };
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
          <button
            className={activeSection === "explore" ? styles.navActive : undefined}
            onClick={() => navigateToSection("explore")}
          >
            Explore
          </button>
          <button
            className={activeSection === "leads" ? styles.navActive : undefined}
            onClick={() => navigateToSection("leads")}
          >
            Leads{leads.length > 0 ? ` (${leads.length})` : ""}
          </button>
          <button
            className={activeSection === "agent" ? styles.navActive : undefined}
            onClick={() => navigateToSection("agent")}
          >
            Agent
          </button>
          <button disabled>Campaigns · Coming soon</button>
          <button disabled>Analytics · Coming soon</button>
        </nav>

        <div className={styles.sourceStatus}>
          <span className={styles.statusDot} />
          County GIS connected · Roof age loaded from the published snapshot
        </div>
      </aside>

      <section className={styles.workspace} id="explore">
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
              onChange={(event) => {
                setRoofAge(Number(event.target.value));
                setSelectedObjectId(null);
              }}
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
              onChange={(event) =>
                updatePermitStatus(event.target.value as "open" | "all")
              }
            >
              <option value="open">Open roofing permits</option>
              <option value="all">All roofing permits</option>
            </select>
          </label>

          <label>
            Open duration
            <select
              aria-label="Open duration"
              value={minimumOpenYears === null ? "any" : String(minimumOpenYears)}
              onChange={(event) => {
                const value = event.target.value;
                setMinimumOpenYears(value === "any" ? null : Number(value));
                setSelectedObjectId(null);
              }}
            >
              <option value="any">Any</option>
              <option value="5">5 years</option>
              <option value="10">10 years</option>
              <option value="15">15 years</option>
              <option value="20">20 years</option>
            </select>
          </label>

          <div className={styles.searchActions}>
            <button
              className={styles.primaryButton}
              disabled={!searchCenter || isSearching}
              onClick={() => {
                void searchProperties();
              }}
            >
              {isSearching ? "Searching…" : "Search properties"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={!searchCenter || isSearching}
              onClick={resetPin}
            >
              Reset pin
            </button>
          </div>
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
                selectedObjectId={selectedObjectId}
                onSearchCenterChange={updateSearchCenter}
                onParcelSelect={selectParcel}
              />
              <span>{locationMessage}</span>
              {hasSearched && mapTruncated ? (
                <span>
                  Map shows the first {mapPageLimit} parcels in this circle.
                  The county returned more.
                </span>
              ) : null}
            </div>
          </section>

          <aside
            className={`${styles.candidatesPanel} ${
              activeSection === "leads" ? styles.sectionFocus : ""
            }`}
            id="leads"
          >
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Geographic matches</p>
                <h3>
                  {activeSection === "leads"
                    ? "Saved leads"
                    : selectedParcel
                      ? "Selected parcel"
                      : "Parcels in radius"}
                </h3>
              </div>
              <span className={styles.count}>
                {activeSection === "leads" ? leads.length : listedParcels.length}
              </span>
            </div>

            <p className={styles.candidateNotice}>
              County GIS determines geographic matches. San Jose roofing
              permits are enriched from the city&apos;s ArcGIS source using APN.
              Open roofing permits lists every parcel in this radius with a
              returned open permit, including parcels below the roof-age
              minimum. All roofing permits keeps the roof-age minimum.
            </p>

            {activeSection === "leads" ? (
              leads.length > 0 ? (
                <div className={styles.candidateList}>
                  {leads.map((lead) => {
                    const parcel = parcelForSavedLead(lead);
                    const savedPermits = lead.permits ?? [];
                    const summary = (
                      <>
                        <div className={styles.candidateCardHeader}>
                          <strong>
                            {lead.address || "Address unavailable"}
                          </strong>
                          <span>APN {lead.apn}</span>
                        </div>
                        <p>{lead.jurisdiction || "Jurisdiction unavailable"}</p>
                        <p>
                          {lead.roofAgeSentence ?? roofAgeCardLabel(lead.apn)}
                        </p>
                        {savedPermits.length > 0 ? (
                          <div className={styles.candidateMeta}>
                            {savedPermits.map((permit) => (
                              <div
                                key={permit.permitNumber}
                                className={styles.permitLine}
                              >
                                <span>
                                  <strong>{permit.permitNumber}</strong>
                                </span>
                                <span>{permit.status}</span>
                                <span>{permit.openDuration}</span>
                                <span>{permit.contractor}</span>
                                {permit.longOpen ? (
                                  <span className={styles.longOpen}>
                                    Long-open
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    );

                    return (
                      <article
                        className={
                          savedPermits.some((permit) => permit.longOpen)
                            ? `${styles.candidateCard} ${styles.candidateCardLongOpen}`
                            : styles.candidateCard
                        }
                        key={lead.apn}
                      >
                        {parcel ? (
                          <button
                            type="button"
                            className={styles.leadOpen}
                            onClick={() => selectParcel(parcel.objectId)}
                          >
                            {summary}
                          </button>
                        ) : (
                          summary
                        )}
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() =>
                            writeSavedLeads(
                              leads.filter((item) => item.apn !== lead.apn)
                            )
                          }
                        >
                          Remove lead
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <strong>No leads saved</strong>
                  <p>
                    Open a parcel from the radius list and save it as a lead.
                  </p>
                </div>
              )
            ) : permitError ? (
              <p className={styles.candidateNotice}>
                Parcel search succeeded, but permit enrichment is unavailable:
                {" "}{permitError}
              </p>
            ) : null}

            {activeSection === "leads" ? null : searchError ? (
              <div className={styles.emptyState}>
                <strong>Search unavailable</strong>
                <p>{searchError}</p>
              </div>
            ) : selectedParcel ? (
              <SelectedParcelDetail
                parcel={selectedParcel}
                permits={roofingPermits.filter(
                  (permit) => permit.apn === selectedParcel.apn
                )}
                onBack={() => setSelectedObjectId(null)}
                saved={leads.some((lead) => lead.apn === selectedParcel.apn)}
                onSave={() => saveLead(selectedParcel)}
              />
            ) : listedParcels.length > 0 ? (
              <div className={styles.candidateList}>
                {listedParcels.map((parcel) => {
                  const permitView = selectedParcelPermitView(
                    roofingPermits.filter((permit) => permit.apn === parcel.apn)
                  );

                  return (
                    <button
                      type="button"
                      className={
                        permitView.permits.some((detail) => detail.longOpen)
                          ? `${styles.candidateCard} ${styles.candidateCardLongOpen}`
                          : styles.candidateCard
                      }
                      key={parcel.objectId}
                      onClick={() => selectParcel(parcel.objectId)}
                    >
                      <div className={styles.candidateCardHeader}>
                        <strong>
                          {parcel.address || "Address unavailable"}
                        </strong>
                        <span>APN {parcel.apn}</span>
                      </div>

                      <p>{parcel.jurisdiction || "Jurisdiction unavailable"}</p>
                      <p>{roofAgeCardLabel(parcel.apn)}</p>

                      <div className={styles.candidateMeta}>
                        {permitView.permits.length === 0 ? (
                          <span>
                            Roofing permit: none returned for selected filter
                          </span>
                        ) : (
                          permitView.permits.map((detail) => (
                            <div
                              key={detail.permitNumber}
                              className={styles.permitLine}
                            >
                              <span>
                                <strong>{detail.permitNumber}</strong>
                              </span>
                              <span>{detail.durationLabel}</span>
                              <span>{detail.contractorLabel}</span>
                              {detail.longOpen ? (
                                <span className={styles.longOpen}>
                                  Long-open
                                </span>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>
                  {hasSearched
                    ? narrowedByOpenPermits
                      ? "Open permits hid these completed roofs"
                      : narrowedByDuration
                        ? `No permit has been open at least ${minimumOpenYears} years`
                        : parcels.length > 0
                          ? "No parcels meet the minimum roof age"
                          : "No parcels returned"
                    : "No search results yet"}
                </strong>
                <p>
                  {hasSearched
                    ? narrowedByOpenPermits
                      ? "These roofs have completed permits, so Open roofing permits hides them. Choose All roofing permits to see them."
                      : narrowedByDuration
                        ? "A parcel stays listed only when one of its permits has no final date and has been open at least that many years."
                        : parcels.length > 0
                          ? "None of the parcels in this radius have a snapshot roof age at least as old as the selected minimum."
                          : "Try another search center or radius."
                    : "Choose a map location or use GPS, then search the county parcel dataset."}
                </p>
              </div>
            )}
          </aside>
        </div>

        <section className={styles.agentPanel} id="agent">
          <div>
            <p className={styles.eyebrow}>RAG agent</p>
            <h3>Ask about roofing opportunities</h3>
            <p className={styles.subtle}>
              The question box answers from loaded parcels and permits.
            </p>
          </div>

          <div className={styles.agentComposer}>
            <input
              aria-label="Ask the roofing intelligence agent"
              placeholder='e.g. "Show open roofing permits older than five years within five miles"'
              value={agentQuestion}
              onChange={(event) => setAgentQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") askAgent();
              }}
            />
            <button type="button" onClick={askAgent}>
              Ask
            </button>
          </div>

          {agentAnswer ? (
            <div className={styles.agentAnswer}>
              <p>{agentAnswer.answer}</p>
              {agentAnswer.matches.length > 0 ? (
                <ul>
                  {agentAnswer.matches.map((match) => {
                    const parcel = parcelByApn(match.apn);
                    const summary = (
                      <>
                        <strong>
                          {match.address} · APN {match.apn}
                        </strong>
                        <span>{match.detail}</span>
                      </>
                    );

                    return (
                      <li key={`${match.apn}-${match.detail}`}>
                        {parcel ? (
                          <button
                            type="button"
                            className={styles.agentMatch}
                            onClick={() => selectParcel(parcel.objectId)}
                          >
                            {summary}
                          </button>
                        ) : (
                          summary
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className={styles.pendingNote}>
              Answers use the parcels and permits loaded for the current
              radius search.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

function SelectedParcelDetail({
  parcel,
  permits,
  onBack,
  saved,
  onSave,
}: {
  parcel: ParcelResult;
  permits: RoofingPermit[];
  onBack: () => void;
  saved: boolean;
  onSave: () => void;
}) {
  const permitView = selectedParcelPermitView(permits);

  return (
    <div className={styles.parcelDetail}>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={onBack}
      >
        Back to radius list
      </button>
      <button
        type="button"
        className={styles.primaryButton}
        onClick={onSave}
        disabled={saved}
      >
        {saved ? "Saved as lead" : "Save as lead"}
      </button>

      <div className={styles.candidateCardHeader}>
        <strong>{parcel.address || "Address unavailable"}</strong>
        <span>APN {parcel.apn}</span>
      </div>
      <p className={styles.detailContext}>
        {parcel.jurisdiction || "Jurisdiction unavailable"}
      </p>
      <p className={styles.detailContext}>{roofAgeCardLabel(parcel.apn)}</p>
      <p className={styles.detailContext}>{roofAgeSourceLabel(parcel.apn)}</p>
      <p className={styles.detailContext}>
        {parcel.latitude !== null && parcel.longitude !== null
          ? `Coordinates ${parcel.latitude.toFixed(5)}, ${parcel.longitude.toFixed(5)}`
          : "Coordinates were not returned for this parcel."}
      </p>
      <p className={styles.detailContext}>
        Location source: Santa Clara County parcel records.
      </p>

      {permitView.noPermitMessage ? (
        <p className={styles.detailValue}>{permitView.noPermitMessage}</p>
      ) : (
        <div className={styles.permitDetails}>
          {permitView.permits.map((detail) => {
            const layerName = permits.find(
              (permit) => permit.permitNumber === detail.permitNumber
            )?.layerName;

            return (
            <section key={detail.permitNumber} className={styles.permitDetail}>
              <h4>{detail.permitNumber}</h4>
              <dl>
                <div>
                  <dt>Permit status</dt>
                  <dd>{detail.status}</dd>
                </div>
                <div>
                  <dt>Open duration</dt>
                  <dd>
                    {detail.durationLabel}
                    {detail.longOpen ? (
                      <span className={styles.longOpen}>Long-open</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Contractor</dt>
                  <dd>{detail.contractorLabel}</dd>
                </div>
                <div>
                  <dt>Permit source</dt>
                  <dd>
                    San Jose building permits
                    {layerName ? `, ${layerName}` : ""}
                  </dd>
                </div>
              </dl>
            </section>
            );
          })}
        </div>
      )}

      <p className={styles.detailValue}>{permitView.bbbRating}</p>
    </div>
  );
}
