import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

// Mirrors the web app's `.wave-animation` CSS keyframes (index.css): a
// quick wobble through the first 60% of a 3.5s cycle, then a rest, on loop.
// transformOrigin matches the CSS's `transform-origin: 70% 70%` so the wrist
// stays put while the fingers wave.
export default function WavingHand({ size = 14 }: { size?: number }) {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const segment = (toValue: number) =>
      Animated.timing(rotate, { toValue, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true });

    const loop = Animated.loop(
      Animated.sequence([
        segment(18),
        segment(-10),
        segment(18),
        segment(-4),
        segment(12),
        segment(0),
        Animated.delay(1400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);

  const rotateDeg = rotate.interpolate({ inputRange: [-10, 18], outputRange: ["-10deg", "18deg"] });

  return (
    <Animated.Text
      style={{
        fontSize: size,
        transform: [{ rotate: rotateDeg }],
        transformOrigin: "70% 70%",
      }}
    >
      👋
    </Animated.Text>
  );
}
