import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import WavingHand from "./WavingHand";

type AuthState = "visitor" | "guest" | "registered";

interface Props {
  authState: AuthState;
  size?: number;
}

// Guest: a slow, gentle nod — settled in (has an identity) but still
// temporary, so nothing as attention-grabbing as the star.
function NoddingHead({ size = 14 }: { size?: number }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const segment = (toValue: number) =>
      Animated.timing(translateY, { toValue, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true });

    const loop = Animated.loop(
      Animated.sequence([segment(-3), segment(0), Animated.delay(1400)]),
    );
    loop.start();
    return () => loop.stop();
  }, [translateY]);

  return (
    <Animated.Text style={{ fontSize: size, transform: [{ translateY }] }}>👤</Animated.Text>
  );
}

// Registered: a little twinkle — scale pop + slight rotate, evoking a
// shining star, reserved for the "real" established account.
function TwinklingStar({ size = 14 }: { size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.3, duration: 280, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 1, duration: 280, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.delay(1600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, rotate]);

  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "22deg"] });

  return (
    <Animated.Text style={{ fontSize: size, transform: [{ scale }, { rotate: rotateDeg }] }}>⭐</Animated.Text>
  );
}

// Mirrors the greeting text next to it (HeaderRight/WebTopNav): 👋 for an
// unidentified visitor, 👤 once there's at least a guest identity, ⭐ once
// that identity is a real registered account. Each state gets its own small
// looping animation rather than a static glyph.
export default function AuthStatusIcon({ authState, size = 14 }: Props) {
  if (authState === "registered") return <TwinklingStar size={size} />;
  if (authState === "guest") return <NoddingHead size={size} />;
  return <WavingHand size={size} />;
}
