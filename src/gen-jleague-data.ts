// Use like this: $npx vite-node src/gen-jleague-data.ts
// You can also use like this: $COMPETITION_YEARS=2024 npx vite-node src/gen-jleague-data.ts

import fs from "node:fs/promises";
import { JSDOM } from "jsdom";
import path from "node:path";

const competitionYears = process.env.COMPETITION_YEARS ?? "2025";
const url = new URL("https://data.j-league.or.jp/SFMS01/search");
const searchParams = new URLSearchParams({
  competition_years: competitionYears,
});
url.search = searchParams.toString();

console.debug(`get from: ${url}`);

const res = await fetch(url);
const dom = new JSDOM(await res.text());
const rows = dom.window.document.querySelectorAll<HTMLTableRowElement>(
  ".search-table tbody tr"
);

console.debug(`rows.length is: ${rows.length}`);

const matches = Array.from(rows).map((row) => {
  const [
    year, // 年度
    tournaments, // 大会
    section, // 節
    date, // 試合日
    kickoff, // K/O時刻
    home, // ホーム
    score, // スコア
    away, // アウェイ
    venue, // スタジアム
    attendance, // 入場者数
    broadcast, // インターネット中継・TV放送
  ] = Array.from(row.querySelectorAll("td")).map(
    (td) => td.textContent?.trim() ?? ""
  );
  return {
    year,
    tournaments,
    section,
    date,
    kickoff,
    home,
    score,
    away,
    venue,
    attendance,
    broadcast,
  };
});

const fileName = `matches-${competitionYears}.json`;
const filePath = path.join(__dirname, "..", "public", fileName);

console.debug(`write to: ${filePath}`);

fs.writeFile(filePath, JSON.stringify(matches, null, 2));
