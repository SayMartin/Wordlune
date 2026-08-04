import React from "react";
import Svg, { Rect, G, Path } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 40 }: LogoProps) {
  const { theme } = useTheme();
  const backgroundFill = theme === "dark" ? "#6366f1" : "#4f46e5";

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Rect width={100} height={100} rx={22} fill={backgroundFill} />

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
