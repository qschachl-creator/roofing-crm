import MapClient from "@/components/MapClient";
import styles from "./page.module.css";

export default function Home() {
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
        <header className={styles.ader}>
          <div>
            <p className={styles.eyebrow}>Territory explorer</p>
            <h2>Find roofing opportunities</h2>
          </div>
          <button className={styles.secondaryButton}>Use my location</button>
        </header>

        <section className={styles.controls} aria-label="Lead search controls">
          <label>
            Search radius
            <select defaultValue="5">
              <option value="1">1 mile</option>
              <option value="3">3 miles</option>
              <option value="5">5 miles</option>
              <option value="10">10 miles</option>
              <option value="25">25 miles</option>
            </select>
          </label>

          <label>
            Minimum roof age
            <select defaultValue="15">
              <option value="10">10 years</option>
              <option value="15">15 years</option>
              <option value="20">20 years</option>
              <option value="25">25 years</option>
            </select>
          </label>

          <label>
            Permit status
            <select defaultValue="open">
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
              <span className={styles.badge}>Map integration pending</span>
            </div>

            <div className={styles.mapPlaceholder}>
              <MapClient />
              <span>
                Click anywhere on the map to place the current search center.
                The circle represents the initial 5-mile radius.
              </span>
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
                Candidate properties will appear after a location, radius, and
                source-backed dataset are connected.
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
