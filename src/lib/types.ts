import type { youtube_v3 } from "googleapis";

export interface ChannelInfo {
  channelId: string;
  channelName: string;
  channelDescription: string;
  customUrl: string;
  subscriberCount: string;
  totalVideoCount: string;
  uploadsPlaylistId: string;
}

export interface VideoMetadata {
  index?: number;
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  channelTitle: string;
  tags: string[];
  categoryId: string;
  duration: string;
  durationSeconds: number;
  durationFormatted?: string;
  definition: string;
  liveBroadcastContent: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  thumbnails: youtube_v3.Schema$ThumbnailDetails;
  url: string;
  serie?: string | null;
  players?: string[];
}

export interface OutputData {
  channel: ChannelInfo;
  extractedAt: string;
  totalVideos: number;
  videos: VideoMetadata[];
}

// Pattern matching types for series and players
export type AliasEntry = string | [string, ...string[]];

export interface PatternMatch {
  pattern: string;
  canonical: string;
}

export function buildPatterns(entries: AliasEntry[]): PatternMatch[] {
  return entries
    .flatMap((entry) => {
      if (typeof entry === "string") {
        return [{ pattern: entry, canonical: entry }];
      }
      const [canonical, ...aliases] = entry;
      return [canonical, ...aliases].map((pattern) => ({ pattern, canonical }));
    })
    .sort((a, b) => b.pattern.length - a.pattern.length);
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
