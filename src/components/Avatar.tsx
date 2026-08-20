import React, { useMemo } from "react";
import { Image, StyleSheet, View, Text } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

// Replaces the old api.dicebear.com avatars. Those sent the player's display
// name (in the URL) plus the *viewer's* IP and User-Agent to a third-party CDN
// on every profile and leaderboard render, for a purely decorative image —
// hard to justify under data minimisation, and an availability dependency on a
// free API for core UI. This renders locally with react-native-svg, which is
// already a dependency (Logo.tsx / WavingHand.tsx are the precedent).
//
// Avatars are deterministic in the seed, so the same player always looks the
// same on every device without anything being stored or fetched.

/** Marks an avatar_url as "generate locally from this seed". */
export const LOCAL_AVATAR_PREFIX = "wordlune:avatar:";

export function localAvatarUrl(seed: string): string {
  return `${LOCAL_AVATAR_PREFIX}${seed}`;
}

export function randomAvatarSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Stable 32-bit hash. Same algorithm as DuelChallengeCard's getChallengeName,
 * chosen for consistency rather than for any cryptographic property — this
 * only picks a colour and a face.
 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Chosen to stay legible against both themes, with white foreground on top.
const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#ef4444",
  "#f97316", "#eab308", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

// Mouth shapes, indexed by hash. Kept deliberately simple — a recognisable,
// friendly mark rather than an attempt to reproduce DiceBear's illustrations.
const MOUTHS = [
  "M 32 60 Q 50 74 68 60", // smile
  "M 32 62 L 68 62", // flat
  "M 34 60 Q 50 70 66 60", // soft smile
  "M 36 58 Q 50 72 64 58", // wide smile
  "M 32 64 Q 50 54 68 64", // wry
];

export interface AvatarProps {
  /** A `wordlune:avatar:<seed>` token, a legacy http(s) URL, or null. */
  uri?: string | null;
  /** Used when `uri` is null or unusable — normally the display name. */
  fallbackSeed?: string | null;
  size?: number;
}

export default function Avatar({ uri, fallbackSeed, size = 96 }: AvatarProps) {
  const seed = useMemo(() => {
    if (uri && uri.startsWith(LOCAL_AVATAR_PREFIX)) {
      return uri.slice(LOCAL_AVATAR_PREFIX.length);
    }
    return fallbackSeed || "guest";
  }, [uri, fallbackSeed]);

  // Tolerate rows still holding an old remote URL. 20260823 nulls the DiceBear
  // ones out, but a native client on an older bundle can still write one, so
  // this stays until that's no longer possible.
  const isRemote = !!uri && /^https?:\/\//.test(uri);
  if (isRemote) {
    return <Image source={{ uri: uri as string }} style={avatarStyle(size)} />;
  }

  const hash = hashSeed(seed);
  const background = PALETTE[hash % PALETTE.length];
  const mouth = MOUTHS[(hash >> 4) % MOUTHS.length];
  // Two eye positions and two sizes give a bit more variety for free.
  const eyeY = 40 + ((hash >> 8) % 2) * 4;
  const eyeR = 4 + ((hash >> 10) % 2);

  return (
    <View style={[avatarStyle(size), { backgroundColor: background, overflow: "hidden" }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={36} cy={eyeY} r={eyeR} fill="#ffffff" />
        <Circle cx={64} cy={eyeY} r={eyeR} fill="#ffffff" />
        <Path
          d={mouth}
          stroke="#ffffff"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

/**
 * Text-only variant for dense lists (leaderboard rows), where rendering an SVG
 * per row is more than the design needs.
 */
export function AvatarInitial({ seed, size = 32 }: { seed?: string | null; size?: number }) {
  const key = seed || "guest";
  const background = PALETTE[hashSeed(key) % PALETTE.length];
  return (
    <View
      style={[
        avatarStyle(size),
        { backgroundColor: background, alignItems: "center", justifyContent: "center" },
      ]}
    >
      <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: size * 0.45 }}>
        {key.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

function avatarStyle(size: number) {
  return { width: size, height: size, borderRadius: size / 2, backgroundColor: "#e5e7eb" };
}

export const styles = StyleSheet.create({});
