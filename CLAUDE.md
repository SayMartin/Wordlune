# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WordseNative is an Expo/React Native port of the "Wordse" web app (a Wordle-style word-guessing game), with Supabase as the backend for auth, word data, scores, and realtime multiplayer (Duel mode). When behavior is ambiguous, the web app's `src/router.jsx` and equivalent hooks are the reference implementation this port mirrors — see comments in `src/navigation/RootNavigator.tsx` for specifics on what's intentionally different. The original web app's repo (`Wordse`) is being retired in favor of this one; `supabase-ops/` (migrations + seed/content scripts, copied from that repo) is the only remaining home for that project's DB migration history and content-seeding tooling — see `supabase-ops/README.md`.

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

**Web target** (`react-native-web`, configured via `web.bundler: "metro"` in `app.config.js`): renders as a full desktop-responsive site (not a phone-frame mockup), matching the original Wordse web app's layout — see `WebTopNav`/`MainTabs` below. `react-native-screens`, `react-native-svg`, `react-native-safe-area-context`, and the Supabase JS client all work through their web-compatible paths. `react` and `react-dom` must stay on the exact same version (a mismatch produces a blank page with a minified React error #527 in the console, no other symptom) — `react-dom` is not in Expo's SDK-managed version set, so bumping `react` requires manually bumping `react-dom` to match. Computer-keyboard input (letters/Enter/Backspace/Space/hyphen) is wired up in `GameScreen.tsx` via a `window.addEventListener("keydown", ...)` effect gated on `Platform.OS === "web"`, mirroring the web app's `Game.tsx` `onKey` handler — native has no equivalent since `addLetter`/`deleteLetter`/`submitGuess` are already reachable via the on-screen `Keyboard` component there.

## Architecture

**Provider stack** (`App.tsx`): `SafeAreaProvider` > `ThemeProvider` > `LoadingProvider` > `AuthProvider` > `NavigationContainer` > `RootNavigator`. Theme colors feed directly into `NavigationContainer`'s theme. No phone-frame wrapper — web renders full-bleed/responsive (see `MainTabs`/`WebTopNav` below).

**Navigation**: `RootNavigator` (native-stack, headers hidden) hosts `MainTabs` (bottom-tabs: Home/Game/Progress/Profile/About) as the `Main` route, plus full-screen stack routes for `Signin`/`Signup`/`Signout`/`Settings`. Real Duel mode lives inside `GameScreen`, not as a separate route (there is no standalone Multiplayer route — that old prototype was removed). Game/Progress/Profile are gated behind `SessionGate` (`src/components/SessionGate.tsx`, wired up in `MainTabs.tsx`), mirroring the web app's `SessionRequiredRoute`: visitors get an inline "Play as Guest / Log In / Sign Up" card instead of the screen; Home/About stay open to visitors.

**Web layout** (`MainTabs.tsx`): on web, `Tab.Navigator`'s bottom tab bar is replaced with `WebTopNav.tsx` via the `tabBar` prop plus `tabBarPosition: "top"` in `screenOptions` (bottom-tabs renders whatever `tabBar` returns at the position given by `tabBarPosition` — without it, a custom `tabBar` still renders at the *bottom*). `WebTopNav` mirrors the original site's `HeaderCopy.tsx`: full-width bar containing a `max-w-4xl`-equivalent (896px, `WebCentered.tsx`) centered row — logo (`Logo.tsx`) + title, language flag, centered Home/Game/Progress/My Profile/About links (active link bold+underlined), and a greeting (`WavingHand.tsx`) + Login/Logout button. Below `useWindowDimensions()`'s 768px breakpoint it collapses to a hamburger dropdown, same breakpoint as the original's Tailwind `md`. Each tab screen (and Signin/Signup/Signout/Settings in `RootNavigator.tsx`) is individually wrapped in `WebCentered` rather than capping the whole navigator, since capping `Tab.Navigator` itself would also shrink `WebTopNav`'s full-width bar. `WebFooter.tsx` (web-only) reproduces the original's page footer. None of this affects native — `isWeb` (`Platform.OS === "web"`) gates every branch, and native keeps the plain bottom-tabs + per-screen header (`HeaderRight.tsx`) it always had.

**Auth** (`src/context/AuthContext.tsx`): wraps Supabase auth (email/password, anonymous sign-in). Derives `authState` = `"visitor" | "guest" | "registered"` from session presence and `session.user.is_anonymous`. Anonymous ("guest") users get a real Supabase session, just flagged anonymous. `logout()` races `signOut()` against a 1s timeout and always clears local state/AsyncStorage `sb-*-auth-token` keys regardless of network outcome, so logout can't hang.

**Game engine** (`src/hooks/useGame.ts`): owns the core Wordle state machine — persisted to AsyncStorage (`wordse:game:v1`) for practice mode only; duel/challenge modes always start from an explicit secret and skip persistence/restore. `evaluateGuess` normalizes hyphen/dash variants and whitespace so multi-word or hyphenated secrets (e.g. category words) evaluate sensibly. Mode is one of `"practice" | "competitive" | "duel"`, driven by `gameModeProp` plus `overrideSecret`.

Composed hooks layered on top of `useGame`, all driven from `GameScreen`:
- `useWordPool` — fetches/filters the candidate word list from Supabase (`words-repository.ts`) based on mode/category/subcategory/length filters; also picks the initial secret for practice mode. Duel mode always pulls from a fixed "Hydrocarbons" subcategory of 5-letter words (`listHydrocarbonFiveLetterWords`).
- `useDuelMode` — realtime 1v1 duel logic over a Supabase Realtime channel (`game:<matchId>`), broadcasting `guess`/`duel_status`/`game_control` events and using presence sync to detect opponent disconnects (auto-awards victory if the opponent leaves mid-duel). Scoring: 5 pts per correct letter, 2 pts per present letter, summed client-side per player and reconciled via broadcast. The hook owns `suddenDeathEndTime`/`setSuddenDeathEndTime` and the auto-forfeit timer off it, but never *sets* it itself — `GameScreen.tsx` must call `setSuddenDeathEndTime(Date.now() + 60000)` when `opponentLost` fires (mirroring the web app's `Game.tsx`), or the whole mechanic silently never triggers despite the hook's internals working fine.
- `useChallengeMode` — multi-word "challenge" runs backed by `challenge_attempts`/`challenge_results` tables; tracks progress index across a fixed word list and only persists a summary row at the end (per-word scores aren't saved individually in competitive/challenge mode).

**Supabase layer** (`src/supabase/*-repository.ts`): thin query wrappers, no ORM. Key tables: `player_profiles`, `game_scores`, `challenge_attempts`/`challenge_results`/`competitive_challenges`, `duel_matches`, `words`/`categories`/`subcategories`/`words_subcategories`. Words are stored with per-language columns (`word_en`, `word_se`/`word_sv` — note the inconsistent `se`/`sv` suffix across tables, handled ad hoc per query). Leaderboards read from DB views (`leaderboard_entries`, `duel_leaderboard`, `player_history_view`, `challenge_menu_stats`) rather than raw tables so visibility/aggregation rules live in Postgres, not the client.

**Realtime boards** (`src/shared/useBoardRealtime.ts`): a separate, more generic pub/sub layer (`board_events`/`board_state` tables, private channels) — distinct from the duel-specific channel in `useDuelMode`.

**i18n** (`src/i18n/i18n.ts`): `en`/`sv` resources from `src/locales/*/translation.json`. Language is never auto-detected from device locale — it defaults to English and only restores a previously *user-selected* language cached in AsyncStorage (`wordse:lang`), mirroring the web app's detector config.

**Theming** (`src/theme/ThemeProvider.tsx`): simple light/dark palette context (not system-linked), always initializes to `"dark"` on boot regardless of persisted value, matching the web app's behavior. Screens consume `colors` from `useTheme()` and apply them manually in `StyleSheet` — there's no CSS-class-based theming.

**Board tiles on web** (`src/components/BoardGrid.tsx`): tile size is fixed per word length on native (phone-tuned table), but on web it grows to fill available space via `useWindowDimensions()` — bounded by both a width fit (against the 896px `WebCentered` column) and a height budget (`windowHeight * 0.32`, since the board sits in a `ScrollView` alongside the header/controls/keyboard/footer). The overall cap is deliberately modest (38px, not width-fit's actual max) — raising it reintroduces vertical scrolling on shorter desktop viewports because the height budget was tuned against that cap, not derived independently. `Keyboard.tsx` intentionally keeps its original fixed key size on web (not scaled to match) per explicit user preference.

**Mode toggle / header-row pills** (`src/components/GameModeToggle.tsx`, sitting in `CategorySelector`'s `headerRow`): both the Practice/Competitive/Duel toggle buttons and `CategorySelector`'s "Select Categories" expand button use an explicit fixed `height: 40` (not padding-derived height) so they line up pixel-for-pixel on the shared row — emoji glyphs (☕🏆⚔️) render with inconsistent line-box metrics across browsers/fonts, so matching heights via padding+line-height alone doesn't reliably hold across environments. `GameModeToggle` shows the active mode as icon+label and inactive modes as icon-only (larger `fontSize: 20` on the icon, `accessibilityLabel` carries the full name) to stay compact enough for the three tabs to fit next to the categories button at phone width.
