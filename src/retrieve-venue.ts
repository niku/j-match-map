// Usage: npx vite-node src/retrieve-venue.ts
// 出力したファイルは（複数候補があるときに正解がわからないので）手動で修正することを想定しています。
import fs from "node:fs/promises";
import path from "node:path";

async function fetchOfficialStadiumNameFromAbbreviation(abbName: string) {
  const url = new URL("https://data.j-league.or.jp/SFCM02/search");
  const searchParams = new URLSearchParams({
    stadium_name: abbName,
  });

  console.debug(`post to: ${url}, with body: ${searchParams}`);

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    method: "POST",
    body: searchParams,
  });

  return JSON.parse(await res.text());
}

const readFileName = "matches-2025.json";
const readFilePath = path.join(__dirname, "..", "public", readFileName);

console.debug(`read from: ${readFilePath}`);

const doc = await fs.readFile(readFilePath, "utf-8");
const matches = JSON.parse(doc) as { [x: string]: string }[];
const venues = new Set<string>(matches.map((match) => match.venue));

console.debug(`venues size is: ${venues.size}`);

const x = {} as { [x: string]: any };
for (const venue of venues) {
  const result = await fetchOfficialStadiumNameFromAbbreviation(venue);
  if (Array.isArray(result)) {
    if (result.length === 1) {
      x[venue] = result[0].name;
    } else {
      x[venue] = result.map((r) => r.name);
    }
  } else {
    x[venue] = "";
    console.error(`failed to retrieve. venue: ${venue}, result: ${result}`);
  }

  // wait for 1 second
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

const writeFileName = "venues.json";
const writeFilePath = path.join(__dirname, "..", "public", writeFileName);

console.debug(`write to: ${writeFilePath}`);

fs.writeFile(writeFilePath, JSON.stringify(x, null, 2));
