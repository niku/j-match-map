import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};
// Select a bundle based on browser checks
const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
// Instantiate the asynchronus version of DuckDB-wasm
const worker = new Worker(bundle.mainWorker!);
const logger = new duckdb.ConsoleLogger();
const db = new duckdb.AsyncDuckDB(logger, worker);
await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

const c = await db.connect();

// matches
await (async () => {
  const fileName = "matches-2025.json";
  const tableName = "matches";
  const streamResponse = await fetch(fileName);
  await db.registerFileBuffer(
    fileName,
    new Uint8Array(await streamResponse.arrayBuffer())
  );
  await c.insertJSONFromPath(fileName, { name: tableName });
})();

// venues
await (async () => {
  const fileName = "venues.json";
  const tableName = "venues";
  const streamResponse = await fetch(fileName);
  await db.registerFileBuffer(
    fileName,
    new Uint8Array(await streamResponse.arrayBuffer())
  );
  await c.insertJSONFromPath(fileName, {
    name: tableName,
  });
})();

// for debugging
declare global {
  interface Window {
    c: any;
  }
}
window.c = c;

// show table
const matches = (
  await c.query(
    `
  SELECT
    matches.year,
    matches.tournaments,
    matches.section,
    matches.date,
    matches.kickoff,
    matches.home,
    matches.score,
    matches.away,
    matches.venue,
    venues.longName AS venueLongName,
    venues.lat AS latitude,
    venues.lon AS longitude,
    matches.attendance,
    matches.broadcast
  FROM matches
  JOIN venues ON matches.venue = venues.shortName
`
  )
)
  .toArray()
  .map((row) => row.toJSON());

const tbody = matches.map((row) => {
  return `
    <tr>
      <td>${row.year}</td>
      <td>${row.tournaments}</td>
      <td>${row.section}</td>
      <td>${row.date}</td>
      <td>${row.kickoff}</td>
      <td>${row.home}</td>
      <td>${row.score}</td>
      <td>${row.away}</td>
      <td>${row.venue}</td>
      <td>${row.venueLongName}</td>
      <td>${row.latitude}</td>
      <td>${row.longitude}</td>
      <td>${row.attendance}</td>
      <td>${row.broadcast}</td>
    </tr>
  `;
});

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <table>
      <thead>
        <tr>
          <th>year</th>
          <th>tournaments</th>
          <th>section</th>
          <th>date</th>
          <th>kickoff</th>
          <th>home</th>
          <th>score</th>
          <th>away</th>
          <th>venue</th>
          <th>venueLongName</th>
          <th>latitude</th>
          <th>longitude</th>
          <th>attendance</th>
          <th>broadcast</th>
        </tr>
      </thead>
      <tbody>${tbody.join("")}</tbody>
    </table>
  </div>
`;
