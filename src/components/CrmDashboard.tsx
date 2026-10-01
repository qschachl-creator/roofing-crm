"use client";

import { useState, useSyncExternalStore } from "react";
import MapClient from "./MapClient";
import styles from "@/app/page.module.css";
import { answerRoofingQuestion } from "@/lib/agentQuery";
import {
  apnBatches,
  isLongOpenPermit,
  parcelsForPermitStatus,
  permitAgeYears,
  selectedParcelPermitView,
} from "@/lib/candidateList";
import {
  installRoofAgeSnapshot,
  parcelsMeetingMinimumRoofAge,
  roofAgeCardLabel,
  type RoofAgeSnapshotRow,
} from "@/lib/roofAgeProof";
import {
  readSavedLeads,
  savedLeadsServerSnapshot,
  subscribeSavedLeads,
  writeSavedLeads,
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
  const listedParcels = parcelsForPermitStatus(
    roofAgeMatches,
    roofingPermits,
    permitStatus
  );
  const narrowedByOpenPermits =
    hasSearched &&
    permitStatus === "open" &&
    roofAgeMatches.length > 0 &&
    listedParcels.length === 0;
  const selectedParcel = selectedObjectId
    ? (listedParcels.find((parcel) => parcel.objectId === selectedObjectId) ??
      null)
    : null;

  function navigateToSection(section: "explore" | "leads" | "agent") {
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
      return;
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

      setRoofingPermits(batches.flat());
      setPermitError(null);
    } catch (permitFailure) {
      setRoofingPermits([]);
      setPermitError(
        permitFailure instanceof Error
          ? permitFailure.message
          : "Permit enrichment failed."
      );
    }
  }

  function updatePermitStatus(status: "open" | "all") {
    setPermitStatus(status);
    setSelectedObjectId(null);
    if (!hasSearched) return;
    void loadPermits(sanJoseApnsFrom(parcels), status);
  }

  function saveLead(parcel: ParcelResult) {
    if (leads.some((lead) => lead.apn === parcel.apn)) {
      setActiveSection("leads");
      return;
    }

    writeSavedLeads([
      ...leads,
      {
        objectId: parcel.objectId,
        apn: parcel.apn,
        address: parcel.address,
        jurisdiction: parcel.jurisdiction,
      },
    ]);
    setActiveSection("leads");
  }

  function askAgent() {
    setAgentAnswer(
      answerRoofingQuestion(agentQuestion, {
        parcels,
        permits: roofingPermits,
        radiusMiles: hasSearched ? radiusMiles : null,
        hasSearched,
        permitError,
      })
    );
    setActiveSection("agent");
  }

  async function searchProperties() {
    if (!searchCenter) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setPermitError(null);
    setRoofingPermits([]);
    setSelectedObjectId(null);

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
      setMapTruncated(payload.truncated);
      setMapPageLimit(payload.pageLimit);
      await loadPermits(sanJoseApnsFrom(payload.parcels), permitStatus);
    } catch (error) {
      setParcels([]);
      setMapTruncated(false);
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
          County GIS connected · Oracle enrichment pending
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
              This list keeps parcels whose Oracle roof-age snapshot meets the
              selected minimum. Parcels without a roof age are omitted.
            </p>

            {activeSection === "leads" ? (
              leads.length > 0 ? (
                <div className={styles.candidateList}>
                  {leads.map((lead) => (
                    <article
                      className={styles.candidateCard}
                      key={lead.objectId}
                    >
                      <div className={styles.candidateCardHeader}>
                        <strong>{lead.address || "Address unavailable"}</strong>
                        <span>APN {lead.apn}</span>
                      </div>
                      <p>
                        {lead.jurisdiction || "Jurisdiction unavailable"} ·{" "}
                        {roofAgeCardLabel(lead.apn)}
                      </p>
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
                  ))}
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
                  const permitLines = roofingPermits
                    .filter((permit) => permit.apn === parcel.apn)
                    .map((permit) => {
                      const age = permitAgeYears(permit.issueDate);
                      const longOpen = isLongOpenPermit(permit.finalDate, age);
                      return { permit, age, longOpen };
                    });

                  return (
                    <button
                      type="button"
                      className={
                        permitLines.some((line) => line.longOpen)
                          ? `${styles.candidateCard} ${styles.candidateCardLongOpen}`
                          : styles.candidateCard
                      }
                      key={parcel.objectId}
                      onClick={() => setSelectedObjectId(parcel.objectId)}
                    >
                      <div className={styles.candidateCardHeader}>
                        <strong>
                          {parcel.address || "Address unavailable"}
                        </strong>
                        <span>APN {parcel.apn}</span>
                      </div>

                      <p>
                        {parcel.jurisdiction || "Jurisdiction unavailable"} ·
                        OBJECTID {parcel.objectId}
                      </p>

                      <div className={styles.candidateMeta}>
                        <span>{roofAgeCardLabel(parcel.apn)}</span>

                        {permitLines.length === 0 ? (
                          <span>
                            Roofing permit: none returned for selected filter
                          </span>
                        ) : (
                          permitLines.map(({ permit, age, longOpen }) => (
                            <div
                              key={permit.permitNumber}
                              className={styles.permitLine}
                            >
                              <span>
                                <strong>{permit.permitNumber}</strong>
                                {" · "}
                                {permit.status || permit.layerName}
                                {permit.issueDate
                                  ? ` · issued ${permit.issueDate}`
                                  : ""}
                                {age !== null
                                  ? ` · ${age.toFixed(1)} years since issue`
                                  : ""}
                                {permit.contractorName
                                  ? ` · contractor source: ${permit.contractorName}`
                                  : ""}
                              </span>
                              {longOpen ? (
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
                      : parcels.length > 0
                        ? "No parcels meet the minimum roof age"
                        : "No parcels returned"
                    : "No search results yet"}
                </strong>
                <p>
                  {hasSearched
                    ? narrowedByOpenPermits
                      ? "These roofs have completed permits, so Open roofing permits hides them. Choose All roofing permits to see them."
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
              Natural-language queries will retrieve matching property and
              permit records before generating an answer.
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
                  {agentAnswer.matches.map((match) => (
                    <li key={`${match.apn}-${match.detail}`}>
                      <strong>
                        {match.address} · APN {match.apn}
                      </strong>
                      <span>{match.detail}</span>
                    </li>
                  ))}
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
        {parcel.jurisdiction || "Jurisdiction unavailable"} ·{" "}
        {roofAgeCardLabel(parcel.apn)}
      </p>

      {permitView.noPermitMessage ? (
        <p className={styles.detailValue}>{permitView.noPermitMessage}</p>
      ) : (
        <div className={styles.permitDetails}>
          {permitView.permits.map((detail) => (
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
              </dl>
            </section>
          ))}
        </div>
      )}

      <p className={styles.detailValue}>{permitView.bbbRating}</p>
    </div>
  );
}
