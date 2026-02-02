#!/usr/bin/env bun
/**
 * Enrich videos with player information
 * Matches player names in video descriptions against players.json
 */

import fs from "fs";
import type { VideoMetadata, AliasEntry } from "../lib/types";
import { buildPatterns, escapeRegex } from "../lib/types";

interface Data {
  videos: VideoMetadata[];
  [key: string]: unknown;
}

const dataPath = new URL(
  "../../data/generated/videos.json",
  import.meta.url,
).pathname;
const playersPath = new URL(
  "../../data/source/players.json",
  import.meta.url,
).pathname;

const data: Data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const players: AliasEntry[] = JSON.parse(fs.readFileSync(playersPath, "utf8"));

const playerPatterns = buildPatterns(players);

function findPlayersInDescription(description: string): string[] {
  const foundPlayers: string[] = [];

  // Remove URLs to avoid false positives (e.g., "khelren.itch.io" matching "Khelren")
  const descriptionWithoutUrls = description.replace(/https?:\/\/[^\s]+/gi, "");

  for (const { pattern, canonical } of playerPatterns) {
    // Skip very short names (2 chars or less) to avoid false positives
    if (pattern.length <= 2) continue;

    // Use Unicode-aware word boundary matching
    // \b doesn't work correctly with accented characters, so we use a custom approach
    // that checks for non-letter characters (or start/end of string) around the pattern
    const regex = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegex(pattern)}(?![\\p{L}\\p{N}])`,
      "iu",
    );
    if (regex.test(descriptionWithoutUrls)) {
      if (!foundPlayers.includes(canonical)) {
        foundPlayers.push(canonical);
      }
    }
  }

  return foundPlayers;
}

// Add players property to each video
data.videos = data.videos.map((video) => ({
  ...video,
  players: findPlayersInDescription(video.description),
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
