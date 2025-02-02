// Usage: npx vite-node src/gen-venue.ts
import fs from "node:fs/promises";
import path from "node:path";

async function readVenueNames() {
  const fileName = "venue-names.json";
  const filePath = path.join(__dirname, "..", "public", fileName);
  const doc = await fs.readFile(filePath, "utf-8");
  const venueNames = JSON.parse(doc) as { [x: string]: string };
  return venueNames;
}

async function readVenueCoordinates() {
  const fileName = "venue-coordinates.json";
  const filePath = path.join(__dirname, "..", "public", fileName);
  const doc = await fs.readFile(filePath, "utf-8");
  const venueCoordinates = JSON.parse(doc) as {
    [x: string]: { lat: number; lon: number };
  };
  return venueCoordinates;
}

function writeVenues(venues: any[]) {
  const fileName = "venues.json";
  const filePath = path.join(__dirname, "..", "public", fileName);
  fs.writeFile(filePath, JSON.stringify(venues, null, 2));
}

const venueNames = await readVenueNames();
const venueCoordinates = await readVenueCoordinates();

const venues = Object.entries(venueCoordinates).map(
  ([shortName, { lat, lon }]) => {
    const longName = venueNames[shortName];
    return {
      shortName,
      longName,
      lat,
      lon,
    };
  }
);

await writeVenues(venues);
