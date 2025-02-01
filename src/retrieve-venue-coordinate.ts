// Usage: npx vite-node src/retrieve-venue-coordinate.ts
import fs from "node:fs/promises";
import path from "node:path";

async function fetchCoordinateFromNames(names: string[]) {
  // API に 50 個以上渡すとエラーになった
  if (50 < names.length) {
    throw new Error("too many names. max is 50.");
  }

  // https://ja.wikipedia.org/w/api.php?&action=help
  const url = new URL("https://ja.wikipedia.org/w/api.php");
  const searchParams = new URLSearchParams({
    format: "json",
    action: "query",
    // https://ja.wikipedia.org/w/api.php?action=help&modules=query
    titles: names.join("|"),
    redirects: "1", // 表記揺れを吸収した、転送先の記事情報を取得する
    prop: "coordinates",
    // https://ja.wikipedia.org/w/api.php?action=help&modules=query%2Bcoordinates
    colimit: "50", // titles の最大が 50 で、title に対応する coordinates は 0 か 1 なので、50 で十分
  });
  url.search = searchParams.toString();

  console.debug(`get from: ${url}`);

  const res = await fetch(url);
  const json = JSON.parse(await res.text());

  const query = json.query;
  const normalized = query.normalized || [];
  const redirects = query.redirects || [];
  const pages = query.pages || {};

  let result = {} as { [x: string]: { lat: number; lon: number } | {} };
  for (const key in pages) {
    const title = pages[key].title;
    const coordinates = pages[key].coordinates;
    if (coordinates) {
      if (1 < coordinates.length) {
        // 複数存在することはないと思っているけれど、もしあったら気づくように表示している
        console.debug(
          `coordinates.length is greater than 1: ${coordinates.length}, on ${title}`
        );
      }
      const coordinate = coordinates[0];
      // title にはノーマライズとリダイレクトした先の名前が入っているので、クエリをかけたときの名前を取りなおす
      // リダイレクトしていない場合は title と queriedName は同じ
      // 例: https://ja.wikipedia.org/w/api.php?format=json&action=query&titles=%E3%82%B5%E3%83%B3%E3%83%97%E3%83%AD%E3%80%80%E3%82%A2%E3%83%AB%E3%82%A6%E3%82%A3%E3%83%B3&redirects=1&prop=coordinates&colimit=50
      // "サンプロ　アルウィン" -> (normalize) -> "サンプロ アルウィン" -> (redirect) -> "長野県松本平広域公園総合球技場"
      // この場合、title は "長野県松本平広域公園総合球技場" になっているが、queriedName は "サンプロ　アルウィン" にしたい
      const redirectedName =
        redirects.find((r: { to: string }) => r.to === title)?.from ?? title;
      const queriedName =
        normalized.find((n: { to: string }) => n.to === redirectedName)?.from ??
        redirectedName;
      result[queriedName] = {
        lat: coordinate.lat,
        lon: coordinate.lon,
      };
    }
  }

  return result;
}

const readFileName = "venue-names.json";
const readFilePath = path.join(__dirname, "..", "public", readFileName);

console.debug(`read from: ${readFilePath}`);

const doc = await fs.readFile(readFilePath, "utf-8");
const venueNames = JSON.parse(doc) as { [x: string]: string };
const venueLongNames = Object.values(venueNames);
const slicedVenueLongNames = venueLongNames.flatMap(
  (_, i, a) => (i % 50 ? [] : [a.slice(i, i + 50)]) // API が一度に受け入れ可能な最大数要素数が 50 なので、それに合わせて分割する
);

let venueCoordinates = {} as { [x: string]: { lat: number; lon: number } | {} };
for (const slicedVenueLongName of slicedVenueLongNames) {
  const fetchedCoordinates = await fetchCoordinateFromNames(
    slicedVenueLongName
  );
  // 関数の返り値のキーは、長い名称(venueNames の値の方)になっている
  // 利用するときには短い名称(venueNames のキーの方)から引くので
  // キーを長い名称から短い名称へと変換する
  const convertedCoordinates = Object.fromEntries(
    Object.entries(fetchedCoordinates).map(([longName, coordinates]) => {
      const abbrevName = Object.entries(venueNames).find(
        ([_abbrev, long]) => long === longName
      )![0]; // ここで戻せなかったら元の情報との整合性が取れていない。必ず戻せる。
      return [abbrevName, coordinates];
    })
  );

  venueCoordinates = {
    ...venueCoordinates,
    ...convertedCoordinates,
  };
}

(() => {
  const writeFileName = "venue-coordinates.json";
  const writeFilePath = path.join(__dirname, "..", "public", writeFileName);

  console.debug(`write to: ${writeFilePath}`);

  fs.writeFile(writeFilePath, JSON.stringify(venueCoordinates, null, 2));
})();

(() => {
  const writeFileName = "venue-incomplete-coordinates.json";
  const writeFilePath = path.join(__dirname, "..", "public", writeFileName);

  console.debug(`write to: ${writeFilePath}`);

  const incompleteCoordinates = Object.fromEntries(
    Object.entries(venueNames).filter(
      ([abbrevName, _longName]) => !venueCoordinates[abbrevName]
    )
  );
  fs.writeFile(writeFilePath, JSON.stringify(incompleteCoordinates, null, 2));
})();
