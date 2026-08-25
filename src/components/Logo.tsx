import React, { useId } from "react";
import Svg, { Rect, G, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 40 }: LogoProps) {
  const { colors } = useTheme();
  // Unique per instance — see Button.tsx for why a shared gradient id breaks.
  const gradientId = `wlLogo${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        {/* The brand gradient, same blue-to-violet as the primary button and
            appfinningar.se's own mark. The badge used to be flat indigo, which
            was close to the accent without matching it. */}
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.accent} />
          <Stop offset="1" stopColor={colors.accent2} />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} rx={22} fill={`url(#${gradientId})`} />

      <G fill="white" fillOpacity={0.4}>
        <Rect x={18} y={16} width={13} height={13} rx={3} />
        <Rect x={35} y={16} width={13} height={13} rx={3} />
        <Rect x={52} y={16} width={13} height={13} rx={3} />
        <Rect x={69} y={16} width={13} height={13} rx={3} />
      </G>

      <G fill="white" fillOpacity={0.7}>
        <Rect x={18} y={33} width={13} height={13} rx={3} />
        <Rect x={35} y={33} width={13} height={13} rx={3} />
        <Rect x={52} y={33} width={13} height={13} rx={3} />
        <Rect x={69} y={33} width={13} height={13} rx={3} />
      </G>

      <Path
        d="M28 60 L39 82 L50 62 L61 82 L72 60"
        stroke="white"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
