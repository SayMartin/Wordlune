import React from "react";
import Svg, { Circle, Line } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

interface Props {
  size?: number;
}

// Two crossed swords. The blades are deliberately the same two colours the
// duel boards use for their labels — success for your side (HostBoard), the
// violet half of the brand gradient for the opponent's (OpponentBoard) — so
// the icon and the boards say the same thing. They were fixed green/orange
// before, which matched neither the boards nor the palette.
export default function DuelIcon({ size = 32 }: Props) {
  const { colors } = useTheme();

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={19} x2={22} y2={2} stroke={colors.success} strokeWidth={3} strokeLinecap="round" />
      <Line x1={2} y1={22} x2={5} y2={19} stroke={colors.textMuted} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={4.25} cy={19.75} r={0.9} fill={colors.danger} />

      <Line x1={18} y1={18} x2={10} y2={2} stroke={colors.accent2} strokeWidth={3} strokeLinecap="round" />
      <Line x1={20} y1={22} x2={18} y2={18} stroke={colors.textMuted} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={18.5} cy={19} r={0.9} fill={colors.danger} />
    </Svg>
  );
}
