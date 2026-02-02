#!/usr/bin/env bun
/**
 * YouTube Channel Video Metadata Extractor
 * Uses the YouTube Data API v3 to fetch metadata for all videos from a channel.
 *
 * Usage:
 *   bun src/scripts/fetch-videos.ts --channel @2d6plusCool
 *   bun src/scripts/fetch-videos.ts --channel-id UCxxxxxxxxxxxx
 *
 * Set YOUTUBE_API_KEY in .env or pass --api-key
 */

import { google, youtube_v3 } from "googleapis";
import * as fs from "fs";
import type { ChannelInfo, VideoMetadata, OutputData } from "../lib/types";

interface Args {
  apiKey: string;
  channel?: string;
  pretty: boolean;
  excludeShorts: boolean;
  excludeLive: boolean;
}

// Parse command line arguments
function parseArgs(): Args {
  const args: Args = {
    apiKey: process.env.YOUTUBE_API_KEY || "",
    channel: process.env.YOUTUBE_CHANNEL,
    pretty: true,
    excludeShorts: true,
    excludeLive: true,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--api-key":
      case "-k":
        args.apiKey = argv[++i];
        break;
      case "--channel":
      case "-c":
        args.channel = argv[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  if (!args.apiKey) {
    console.error(
      "Error: YOUTUBE_API_KEY env variable or --api-key is required",
    );
    printHelp();
    process.exit(1);
  }

  if (!args.channel) {
    console.error(
      "Error: YOUTUBE_CHANNEL env variable or --channel is required",
    );
    printHelp();
    process.exit(1);
  }

  return args;
}

function printHelp(): void {
  console.log(`
YouTube Channel Video Metadata Extractor

Usage:
  bun src/scripts/fetch-videos.ts [options]

Options:
  -k, --api-key <key>       YouTube Data API v3 key (or set YOUTUBE_API_KEY env)
  -c, --channel <handle>    Channel handle (e.g., @2d6plusCool, or set YOUTUBE_CHANNEL env)
  -h, --help                Show this help message

Example:
  bun src/scripts/fetch-videos.ts -c @2d6plusCool
`);
}

// Get channel ID from handle or custom URL
async function getChannelId(
  youtube: youtube_v3.Youtube,
  channelIdentifier: string,
): Promise<string> {
  // If already a channel ID, return as-is
  if (channelIdentifier.startsWith("UC") && channelIdentifier.length === 24) {
    return channelIdentifier;
  }

  // Remove @ if present
  const handle = channelIdentifier.replace(/^@/, "");

  // Search for the channel by handle
  const response = await youtube.search.list({
    part: ["snippet"],
    q: handle,
    type: ["channel"],
    maxResults: 1,
  });

  if (response.data.items && response.data.items.length > 0) {
    const channelId = response.data.items[0].snippet?.channelId;
    if (channelId) {
      return channelId;
    }
  }

  throw new Error(`Could not find channel: ${channelIdentifier}`);
}

// Get channel details including uploads playlist ID
async function getChannelInfo(
  youtube: youtube_v3.Youtube,
  channelId: string,
): Promise<ChannelInfo> {
  const response = await youtube.channels.list({
    part: ["snippet", "contentDetails", "statistics"],
    id: [channelId],
  });

  if (!response.data.items || response.data.items.length === 0) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const channel = response.data.items[0];

  return {
    channelId,
    channelName: channel.snippet?.title || "",
    channelDescription: channel.snippet?.description || "",
    customUrl: channel.snippet?.customUrl || "",
    subscriberCount: channel.statistics?.subscriberCount || "hidden",
    totalVideoCount: channel.statistics?.videoCount || "0",
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || "",
  };
}

// Fetch all video IDs from a playlist
async function getAllVideoIds(
  youtube: youtube_v3.Youtube,
  playlistId: string,
): Promise<string[]> {
  const videoIds: string[] = [];
  let nextPageToken: string | undefined;

  console.log("Fetching video list from channel...");

  do {
    const response = await youtube.playlistItems.list({
      part: ["contentDetails"],
      playlistId,
      maxResults: 50,
      pageToken: nextPageToken,
    });

    if (response.data.items) {
      for (const item of response.data.items) {
        if (item.contentDetails?.videoId) {
          videoIds.push(item.contentDetails.videoId);
        }
      }
    }

    console.log(`  Found ${videoIds.length} videos so far...`);
    nextPageToken = response.data.nextPageToken || undefined;
  } while (nextPageToken);

  return videoIds;
}

// Fetch detailed metadata for videos (50 at a time)
async function getVideoDetails(
  youtube: youtube_v3.Youtube,
  videoIds: string[],
): Promise<VideoMetadata[]> {
  const videos: VideoMetadata[] = [];

  console.log(`\nFetching detailed metadata for ${videoIds.length} videos...`);

  // Process in batches of 50
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);

    const response = await youtube.videos.list({
      part: ["snippet", "contentDetails", "statistics"],
      id: batch,
    });

    if (response.data.items) {
      for (const item of response.data.items) {
        const duration = item.contentDetails?.duration || "";
        const video: VideoMetadata = {
          videoId: item.id || "",
          title: item.snippet?.title || "",
          description: item.snippet?.description || "",
          publishedAt: item.snippet?.publishedAt || "",
          channelTitle: item.snippet?.channelTitle || "",
          tags: item.snippet?.tags || [],
          categoryId: item.snippet?.categoryId || "",
          duration,
          durationSeconds: parseDurationToSeconds(duration),
          definition: item.contentDetails?.definition || "",
          liveBroadcastContent: item.snippet?.liveBroadcastContent || "none",
          viewCount: parseInt(item.statistics?.viewCount || "0", 10),
          likeCount: parseInt(item.statistics?.likeCount || "0", 10),
          commentCount: parseInt(item.statistics?.commentCount || "0", 10),
          thumbnails: item.snippet?.thumbnails || {},
          url: `https://www.youtube.com/watch?v=${item.id}`,
        };
        videos.push(video);
      }
    }

    console.log(
      `  Processed ${Math.min(i + 50, videoIds.length)}/${videoIds.length} videos...`,
    );
  }

  return videos;
}

// Convert ISO 8601 duration to seconds
function parseDurationToSeconds(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

// Convert ISO 8601 duration to human-readable format
function parseDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) {
    return isoDuration;
  }

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Main function
async function main(): Promise<void> {
  const args = parseArgs();

  // Initialize YouTube API client
  const youtube = google.youtube({
    version: "v3",
    auth: args.apiKey,
  });

  try {
    // Get channel ID
    console.log(`Looking up channel: ${args.channel}`);
    const channelId = await getChannelId(youtube, args.channel!);

    console.log(`Channel ID: ${channelId}`);

    // Get channel info
    const channelInfo = await getChannelInfo(youtube, channelId);
    console.log(`Channel: ${channelInfo.channelName}`);
    console.log(`Total videos (reported): ${channelInfo.totalVideoCount}`);

    // Get all video IDs from uploads playlist
    const videoIds = await getAllVideoIds(
      youtube,
      channelInfo.uploadsPlaylistId,
    );
    console.log(`\nFound ${videoIds.length} videos in uploads playlist`);

    // Get detailed metadata for all videos
    let videos = await getVideoDetails(youtube, videoIds);

    // Filter out Shorts if requested (videos <= 300 seconds)
    if (args.excludeShorts) {
      const beforeCount = videos.length;
      videos = videos.filter((v) => v.durationSeconds > 300);
      console.log(`Filtered out ${beforeCount - videos.length} Shorts`);
    }

    // Filter out live streams if requested
    if (args.excludeLive) {
      const beforeCount = videos.length;
      videos = videos.filter((v) => v.liveBroadcastContent === "none");
      console.log(
        `Filtered out ${beforeCount - videos.length} live/premiere videos`,
      );
    }

    // Add human-readable duration
    videos = videos.map((video) => ({
      ...video,
      durationFormatted: parseDuration(video.duration),
    }));

    // Sort by publish date (newest first)
    videos.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    // Add index
    videos = videos.map((video, i) => ({
      ...video,
      index: i + 1,
    }));

    // Build final output
    const output: OutputData = {
      channel: channelInfo,
      extractedAt: new Date().toISOString(),
      totalVideos: videos.length,
      videos,
    };

    // Save to file
    const outputPath = new URL(
      "../../data/generated/videos.json",
      import.meta.url,
    ).pathname;
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");

    console.log(
      `\n✓ Saved metadata for ${videos.length} videos to: ${outputPath}`,
    );

    // Print summary
    const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
    const totalLikes = videos.reduce((sum, v) => sum + v.likeCount, 0);

    console.log(`\nChannel Statistics:`);
    console.log(`  Total views: ${totalViews.toLocaleString()}`);
    console.log(`  Total likes: ${totalLikes.toLocaleString()}`);
    console.log(`  Newest video: ${videos[0].title.substring(0, 50)}...`);
    console.log(
      `  Oldest video: ${videos[videos.length - 1].title.substring(0, 50)}...`,
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`);
    } else {
      console.error(`\nError: ${error}`);
    }
    process.exit(1);
  }
}

main();
