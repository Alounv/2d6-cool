import fs from "fs";

interface Video {
  title: string;
  serie?: string | null;
  [key: string]: unknown;
}

interface Data {
  videos: Video[];
}

const dataPath = new URL("../data/videos.json", import.meta.url).pathname;
const seriesPath = new URL("../data/series.json", import.meta.url).pathname;

const data: Data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const series: (string | [string, ...string[]])[] = JSON.parse(
  fs.readFileSync(seriesPath, "utf8"),
);

// Build a flat list of {pattern, canonical} for matching, sorted by pattern length descending
const seriesPatterns = series
  .flatMap((entry) => {
    if (typeof entry === "string") {
      return [{ pattern: entry, canonical: entry }];
    }
    const [canonical, ...aliases] = entry;
    return [canonical, ...aliases].map((pattern) => ({ pattern, canonical }));
  })
  .sort((a, b) => b.pattern.length - a.pattern.length);

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
