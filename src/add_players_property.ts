import fs from "fs";

interface Video {
  title: string;
  description: string;
  players?: string[];
  [key: string]: unknown;
}

interface Data {
  videos: Video[];
}

const dataPath = new URL("../data/videos.json", import.meta.url).pathname;
const playersPath = new URL("../data/players.json", import.meta.url).pathname;

const data: Data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const players: (string | [string, ...string[]])[] = JSON.parse(
  fs.readFileSync(playersPath, "utf8"),
);

// Build a flat list of {pattern, canonical} for matching, sorted by pattern length descending
const playerPatterns = players
  .flatMap((entry) => {
    if (typeof entry === "string") {
      return [{ pattern: entry, canonical: entry }];
    }
    const [canonical, ...aliases] = entry;
    return [canonical, ...aliases].map((pattern) => ({ pattern, canonical }));
  })
  .sort((a, b) => b.pattern.length - a.pattern.length);

function findPlayersInDescription(description: string): string[] {
  // Search for known player names anywhere in the description
  // Use word boundaries to avoid partial matches
  const foundPlayers: string[] = [];

  for (const { pattern, canonical } of playerPatterns) {
    // Skip very short names (2 chars or less) to avoid false positives
    if (pattern.length <= 2) continue;

    // Create a regex with word boundaries
    const regex = new RegExp(`\\b${escapeRegex(pattern)}\\b`, "i");
    if (regex.test(description)) {
      if (!foundPlayers.includes(canonical)) {
        foundPlayers.push(canonical);
      }
    }
  }

  return foundPlayers;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNames(rawNames: string[]): string[] {
  const foundPlayers: string[] = [];

  for (const rawName of rawNames) {
    const lowerName = rawName.toLowerCase();
    let matched = false;

    for (const { pattern, canonical } of playerPatterns) {
      if (lowerName === pattern.toLowerCase()) {
        if (!foundPlayers.includes(canonical)) {
          foundPlayers.push(canonical);
        }
        matched = true;
        break;
      }
    }

    // If no exact match found, add the raw name if it's valid
    if (!matched && rawName.length > 1) {
      // Check it's not already added via canonical
      const alreadyAdded = foundPlayers.some((p) =>
        playerPatterns.some(
          (pp) => pp.canonical === p && pp.pattern.toLowerCase() === lowerName,
        ),
      );
      if (!alreadyAdded) {
        foundPlayers.push(rawName);
      }
    }
  }

  return foundPlayers;
}

function extractPlayersFromDescription(description: string): string[] {
  return findPlayersInDescription(description);
}

// Add players property to each video
data.videos = data.videos.map((video) => ({
  ...video,
  players: extractPlayersFromDescription(video.description),
}));

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

// Count statistics
const withPlayers = data.videos.filter(
  (v) => v.players && v.players.length > 0,
).length;
const withoutPlayers = data.videos.filter(
  (v) => !v.players || v.players.length === 0,
).length;

// Count unique players
const allPlayers = new Set<string>();
data.videos.forEach((v) => {
  if (v.players) {
    v.players.forEach((p) => allPlayers.add(p));
  }
});

console.log("Total videos:", data.videos.length);
console.log("With players:", withPlayers);
console.log("Without players:", withoutPlayers);
console.log("Unique players found:", allPlayers.size);

// List videos without players
console.log("\nVideos without players:");
data.videos
  .filter((v) => !v.players || v.players.length === 0)
  .forEach((v) => console.log("-", v.title));
