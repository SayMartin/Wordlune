import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Home: undefined;
  Game: { mode?: "duel" } | undefined;
  Progress: undefined;
  Profile: undefined;
  About: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Settings: undefined;
  Signup: undefined;
  Signin: undefined;
  Signout: undefined;
  NotFound: undefined;
};

// Screens nested inside the tab navigator need to reach both tab siblings
// (Home, Game, ...) and root-level stack screens (Signin, Signup, ...).
// `navigate(name)` bubbles up through ancestor navigators at runtime, so a
// merged param list keeps call sites simple instead of fighting
// CompositeNavigationProp generics at every nested screen.
export type AppParamList = RootStackParamList & MainTabParamList;
