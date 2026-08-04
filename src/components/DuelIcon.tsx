import React from "react";
import Svg, { Circle, Line } from "react-native-svg";

interface Props {
  size?: number;
}

export default function DuelIcon({ size = 32 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={19} x2={22} y2={2} stroke="#22c55e" strokeWidth={3} strokeLinecap="round" />
      <Line x1={2} y1={22} x2={5} y2={19} stroke="#cbd5e1" strokeWidth={4} strokeLinecap="round" />
      <Circle cx={4.25} cy={19.75} r={0.9} fill="#ef4444" />

      <Line x1={18} y1={18} x2={10} y2={2} stroke="#ea580c" strokeWidth={3} strokeLinecap="round" />
      <Line x1={20} y1={22} x2={18} y2={18} stroke="#cbd5e1" strokeWidth={4} strokeLinecap="round" />
      <Circle cx={18.5} cy={19} r={0.9} fill="#ef4444" />
    </Svg>
  );
}
