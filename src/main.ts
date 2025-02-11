import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

function selectMatchesSQL(teams: string[]): string {
  if (teams.length === 0) {
    throw new Error("assume teams is not empty");
  }
  const selectSQL = `
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
      matches.broadcast,
      strptime(regexp_extract(date, '(\\d+/\\d+)'), '%m/%d') as parsedDate -- for sorting
    FROM matches
    JOIN venues ON matches.venue = venues.shortName
  `;
  const orderClause = `ORDER BY parsedDate ASC, kickoff ASC, tournaments ASC, section ASC`;
  const param = teams.map((team) => `'${team}'`).join(", ");
  const whereClause = `WHERE matches.home IN (${param}) OR matches.away IN (${param})`;
  return selectSQL + " " + whereClause + " " + orderClause;
}

function renderTable(matches: any[]) {
  const tbody = matches.map((row) => {
    return `
        <tr data-venue="${row.venue}">
          <td>${row.year}</td>
          <td>${row.tournaments}</td>
          <td>${row.section}</td>
          <td>${row.date}</td>
          <td>${row.kickoff}</td>
          <td>${row.home}</td>
          <td>${row.score}</td>
          <td>${row.away}</td>
          <td>${row.venueLongName}</td>
        </tr>
      `;
  });

  document.querySelector<HTMLDivElement>("#table")!.innerHTML = `
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
              <th>venueLongName</th>
            </tr>
          </thead>
          <tbody>${tbody.join("")}</tbody>
        </table>
      </div>
    `;

  // TOOD: 毎回やったらイベントリスナーが重複していくんだっけ？
  document
    .querySelectorAll<HTMLTableRowElement>("#table tbody tr")!
    .forEach((tr) => {
      tr.addEventListener("click", onClickTr);
    });
}

function onClickTr(event: Event) {
  const tr = (event.currentTarget as HTMLElement).closest("tr");
  if (tr) {
    const venue = tr.getAttribute("data-venue");
    geoJSONData.eachLayer((layer) => {
      layer.closePopup(); // close all popups
    });
    geoJSONData.eachLayer((layer) => {
      const feature = (layer as L.GeoJSON).feature;
      const properties = (feature as GeoJSON.Feature).properties;
      if (properties!.shortName === venue) {
        layer.openPopup();
      }
    });
  }
}

function renderCondition() {
  const teams = {
    J1: [
      "鹿島",
      "浦和",
      "柏",
      "FC東京",
      "東京Ｖ",
      "町田",
      "川崎Ｆ",
      "横浜FM",
      "横浜FC",
      "湘南",
      "新潟",
      "清水",
      "名古屋",
      "京都",
      "Ｇ大阪",
      "Ｃ大阪",
      "神戸",
      "岡山",
      "広島",
      "福岡",
    ],
    J2: [
      "札幌",
      "仙台",
      "秋田",
      "山形",
      "いわき",
      "水戸",
      "大宮",
      "千葉",
      "甲府",
      "富山",
      "磐田",
      "藤枝",
      "山口",
      "徳島",
      "愛媛",
      "今治",
      "鳥栖",
      "長崎",
      "熊本",
      "大分",
    ],
    J3: [
      "八戸",
      "福島",
      "栃木SC",
      "栃木Ｃ",
      "群馬",
      "相模原",
      "松本",
      "長野",
      "金沢",
      "沼津",
      "岐阜",
      "FC大阪",
      "奈良",
      "鳥取",
      "讃岐",
      "高知",
      "北九州",
      "宮崎",
      "鹿児島",
      "琉球",
    ],
  };

  const teamList = Object.values(teams).reduce((acc, teams) => {
    return acc.concat(teams);
  }, []);

  const checkboxList = teamList
    .map((team) => {
      return `<input class="team-selector" type="checkbox" id="${team}" name="team" checked><label for="${team}">${team}</label>`;
    })
    .join("");

  document.querySelector<HTMLDivElement>("#condition")!.innerHTML = `
    <button id="clear">Clear</button>
    <button id="select-all">Select all</button>
    <button id="select-j1">Select J1</button>
    <button id="select-j2">Select J2</button>
    <button id="select-j3">Celect J3</button>
    <div id="teams">${checkboxList}</div>`;
  document
    .querySelector<HTMLButtonElement>("#clear")!
    .addEventListener("click", () => {
      document
        .querySelectorAll<HTMLInputElement>(".team-selector")
        .forEach((x) => (x.checked = false));
      onChangeSelectedTeams();
    });
  document
    .querySelector<HTMLButtonElement>("#select-all")!
    .addEventListener("click", () => {
      document
        .querySelectorAll<HTMLInputElement>(".team-selector")
        .forEach((x) => (x.checked = true));
      onChangeSelectedTeams();
    });
  document
    .querySelector<HTMLButtonElement>("#select-j1")!
    .addEventListener("click", () => {
      document
        .querySelectorAll<HTMLInputElement>(
          teams["J1"].map((x) => `#${x}`).join(",")
        )
        .forEach((x) => (x.checked = true));
      onChangeSelectedTeams();
    });
  document
    .querySelector<HTMLButtonElement>("#select-j2")!
    .addEventListener("click", () => {
      document
        .querySelectorAll<HTMLInputElement>(
          teams["J2"].map((x) => `#${x}`).join(",")
        )
        .forEach((x) => (x.checked = true));
      onChangeSelectedTeams();
    });
  document
    .querySelector<HTMLButtonElement>("#select-j3")!
    .addEventListener("click", () => {
      document
        .querySelectorAll<HTMLInputElement>(
          teams["J3"].map((x) => `#${x}`).join(",")
        )
        .forEach((x) => (x.checked = true));
      onChangeSelectedTeams();
    });

  document
    .querySelector<HTMLDivElement>("#teams")!
    .addEventListener("change", onChangeSelectedTeams);
}

async function onChangeSelectedTeams() {
  const selectedTeams = Array.from(
    document.querySelectorAll('input[name="team"]:checked')
  ).map((x) => x.id);

  let matches: any[];
  if (selectedTeams.length === 0) {
    matches = [];
  } else {
    const sql = selectMatchesSQL(selectedTeams);
    matches = (await c.query(sql)).toArray().map((row) => row.toJSON());
  }
  const geoJSON = makeMatchesGeoJSON(matches);
  renderMap(geoJSON);
  renderTable(matches);
}

function makeMatchesGeoJSON(matches: any[]) {
  const groupByVenue = matches.reduce(
    (acc: { [key: string]: typeof matches }, match) => {
      if (!acc[match.venue]) {
        acc[match.venue] = [];
      }
      acc[match.venue].push(match);
      return acc;
    },
    {} as { [key: string]: typeof matches }
  );

  const features: GeoJSON.Feature[] = Object.entries(groupByVenue).map(
    ([venue, ms]) => {
      const properties = {
        shortName: venue,
        longName: ms[0].venueLongName,
        matches: ms.map((m) => {
          return {
            year: m.year,
            tournaments: m.tournaments,
            section: m.section,
            date: m.date,
            kickoff: m.kickoff,
            home: m.home,
            score: m.score,
            away: m.away,
            attendance: m.attendance,
            broadcast: m.broadcast,
          };
        }),
      };

      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [ms[0].longitude, ms[0].latitude],
        },
        properties: properties,
      };
    }
  );

  const geoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: features,
  };

  return geoJSON;
}

const latLng = { lat: 35.67514, lng: 139.66641 };
const map = L.map("map");
map.setView(latLng, 6);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

let geoJSONData = L.geoJSON();

function renderMap(geoJSON: GeoJSON.FeatureCollection) {
  map.removeLayer(geoJSONData);
  geoJSONData = L.geoJSON(geoJSON, {
    onEachFeature(feature, layer) {
      layer.bindTooltip(feature.properties.longName);
      const rows = feature.properties.matches.map((match: any) => {
        return (
          `<tr>` +
          // `<td>${match.year}</td>` +
          // `<td>${match.tournaments}</td>` +
          // `<td>${match.section}</td>` +
          `<td>${match.date}</td>` +
          `<td>${match.kickoff}</td>` +
          `<td>${match.home}</td>` +
          // `<td>${match.score}</td>` +
          `<td>${match.away}</td>` +
          // `<td>${match.attendance}</td>` +
          // `<td>${match.broadcast}</td>` +
          `</tr>`
        );
      });
      layer.bindPopup(
        `<table><thead><th>date</th><th>kickoff</th><th>home</th><th>away</th></thead>${rows.join(
          ""
        )}</table>`
      );
    },
  }).addTo(map);
}

renderCondition();
onChangeSelectedTeams();
