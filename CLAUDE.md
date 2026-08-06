# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WordseNative is an Expo/React Native port of the "Wordse" web app (a Wordle-style word-guessing game), with Supabase as the backend for auth, word data, scores, and realtime multiplayer (Duel mode). When behavior is ambiguous, the web app's `src/router.jsx` and equivalent hooks are the reference implementation this port mirrors — see comments in `src/navigation/RootNavigator.tsx` for specifics on what's intentionally different.

## Commands

```sh
npm start           # Start Metro/Expo dev server
npm run android      # expo run:android
npm run ios          # expo run:ios (run `bundle install` then `bundle exec pod install` first if native deps changed)
npm run web          # expo start --web (dev server + browser tab)
npm run build:web    # expo export --platform web -> static site in dist/, deployable to any static host
npm run lint          # eslint .
npm test             # jest (jest-expo preset)
```

Run a single test file: `npx jest __tests__/App.test.tsx`.

Requires Node >= 22.11.0. Supabase credentials are read from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`.env`, see `.env.example`). If unset, `src/supabaseClient.ts` falls back to a no-op stub client so the app still renders in dev/test without a backend.

Android builds (`npm run android` / Gradle) need the daemon JVM on **Java 17 or 21**, not whatever the system default happens to be — JDK 24+ trips a JNI-restriction warning during the prefab/CMake native-build steps (`configureCMakeDebug[armeabi-v7a]`) that Android Gradle Plugin misreports as a build failure. Pin it via `org.gradle.java.home` in `~/.gradle/gradle.properties` (machine-local, not the repo's `android/gradle.properties`) rather than changing the system JDK.

**Web target** (`react-native-web`, configured via `web.bundler: "metro"` in `app.config.js`): all screens/navigation render on web with no code changes so far — `react-native-screens`, `react-native-svg`, `react-native-safe-area-context`, and the Supabase JS client all work through their web-compatible paths. `react` and `react-dom` must stay on the exact same version (a mismatch produces a blank page with a minified React error #527 in the console, no other symptom) — `react-dom` is not in Expo's SDK-managed version set, so bumping `react` requires manually bumping `react-dom` to match.

## Architecture

**Provider stack** (`App.tsx`): `SafeAreaProvider` > `ThemeProvider` > `LoadingProvider` > `AuthProvider` > `NavigationContainer` > `RootNavigator`. Theme colors feed directly into `NavigationContainer`'s theme.

**Navigation**: `RootNavigator` (native-stack, headers hidden) hosts `MainTabs` (bottom-tabs: Home/Game/Progress/Profile/About) as the `Main` route, plus full-screen stack routes for `Signin`/`Signup`/`Signout`/`Settings`. `MultiplayerScreen` is a superseded standalone prototype — real Duel mode lives inside `GameScreen`, not as a separate route. There is no auth-gate redirect yet on Game/Progress/Profile — `useAuth().isAuthenticated` needs to be checked by callers.

**Auth** (`src/context/AuthContext.tsx`): wraps Supabase auth (email/password, anonymous sign-in). Derives `authState` = `"visitor" | "guest" | "registered"` from session presence and `session.user.is_anonymous`. Anonymous ("guest") users get a real Supabase session, just flagged anonymous. `logout()` races `signOut()` against a 1s timeout and always clears local state/AsyncStorage `sb-*-auth-token` keys regardless of network outcome, so logout can't hang.

**Game engine** (`src/hooks/useGame.ts`): owns the core Wordle state machine — persisted to AsyncStorage (`wordse:game:v1`) for practice mode only; duel/challenge modes always start from an explicit secret and skip persistence/restore. `evaluateGuess` normalizes hyphen/dash variants and whitespace so multi-word or hyphenated secrets (e.g. category words) evaluate sensibly. Mode is one of `"practice" | "competitive" | "duel"`, driven by `gameModeProp` plus `overrideSecret`.

Composed hooks layered on top of `useGame`, all driven from `GameScreen`:
- `useWordPool` — fetches/filters the candidate word list from Supabase (`words-repository.ts`) based on mode/category/subcategory/length filters; also picks the initial secret for practice mode. Duel mode always pulls from a fixed "Hydrocarbons" subcategory of 5-letter words (`listHydrocarbonFiveLetterWords`).
- `useDuelMode` — realtime 1v1 duel logic over a Supabase Realtime channel (`game:<matchId>`), broadcasting `guess`/`duel_status`/`game_control` events and using presence sync to detect opponent disconnects (auto-awards victory if the opponent leaves mid-duel). Scoring: 5 pts per correct letter, 2 pts per present letter, summed client-side per player and reconciled via broadcast.
- `useChallengeMode` — multi-word "challenge" runs backed by `challenge_attempts`/`challenge_results` tables; tracks progress index across a fixed word list and only persists a summary row at the end (per-word scores aren't saved individually in competitive/challenge mode).

**Supabase layer** (`src/supabase/*-repository.ts`): thin query wrappers, no ORM. Key tables: `player_profiles`, `game_scores`, `challenge_attempts`/`challenge_results`/`competitive_challenges`, `duel_matches`, `words`/`categories`/`subcategories`/`words_subcategories`. Words are stored with per-language columns (`word_en`, `word_se`/`word_sv` — note the inconsistent `se`/`sv` suffix across tables, handled ad hoc per query). Leaderboards read from DB views (`leaderboard_entries`, `duel_leaderboard`, `player_history_view`, `challenge_menu_stats`) rather than raw tables so visibility/aggregation rules live in Postgres, not the client.

**Realtime boards** (`src/shared/useBoardRealtime.ts`): a separate, more generic pub/sub layer (`board_events`/`board_state` tables, private channels) — distinct from the duel-specific channel in `useDuelMode`.

**i18n** (`src/i18n/i18n.ts`): `en`/`sv` resources from `src/locales/*/translation.json`. Language is never auto-detected from device locale — it defaults to English and only restores a previously *user-selected* language cached in AsyncStorage (`wordse:lang`), mirroring the web app's detector config.

**Theming** (`src/theme/ThemeProvider.tsx`): simple light/dark palette context (not system-linked), always initializes to `"dark"` on boot regardless of persisted value, matching the web app's behavior. Screens consume `colors` from `useTheme()` and apply them manually in `StyleSheet` — there's no CSS-class-based theming.
