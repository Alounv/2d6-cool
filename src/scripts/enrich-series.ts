#!/usr/bin/env bun
/**
 * Enrich videos with series information
 * Matches video titles against series patterns from series.json
 */

import fs from "fs";
import type { VideoMetadata, AliasEntry } from "../lib/types";
import { buildPatterns } from "../lib/types";

interface Data {
  videos: VideoMetadata[];
  [key: string]: unknown;
}

const dataPath = new URL(
  "../../data/generated/videos.json",
  import.meta.url,
).pathname;
const seriesPath = new URL(
  "../../data/source/series.json",
  import.meta.url,
).pathname;

const data: Data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const series: AliasEntry[] = JSON.parse(fs.readFileSync(seriesPath, "utf8"));

const seriesPatterns = buildPatterns(series);

function findSerie(title: string): string | null {
  const lowerTitle = title.toLowerCase();
  for (const { pattern, canonical } of seriesPatterns) {
    if (lowerTitle.includes(pattern.toLowerCase())) {
      return canonical;
    }
  }
  return null;
}

// Add serie property to each video
data.videos = data.videos.map((video) => ({
  ...video,
  serie: findSerie(video.title),
}));

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

// Count how many videos have a serie assigned
const withSerie = data.videos.filter((v) => v.serie !== null).length;
const withoutSerie = data.videos.filter((v) => v.serie === null).length;

console.log("Total videos:", data.videos.length);
console.log("With serie:", withSerie);
console.log("Without serie:", withoutSerie);

// List all videos without serie
console.log("\nVideos without serie:");
data.videos
  .filter((v) => v.serie === null)
  .forEach((v) => console.log("-", v.title));
