# Wordlune

Wordlune is a Wordle-style word-guessing game — guess the secret word letter by letter, with feedback on which letters are correct, present, or absent. Playable on iOS, Android, and in the browser.

Live at **[wordlune.se](https://wordlune.se)**.

## Tech stack

- **Expo / React Native** — cross-platform app (iOS, Android), with [react-native-web](https://necolas.github.io/react-native-web/) powering the browser version from the same codebase. The web version is a full responsive desktop site (top nav bar, hamburger menu on narrow windows) rather than a mobile-only view, and supports typing guesses directly on your computer's keyboard.
- **Supabase** — backend for authentication, word data, scores, and realtime multiplayer.
- **React Navigation** — bottom tabs on iOS/Android, a top nav bar on web (Home, Game, Progress, Settings, About), plus full-screen auth/settings flows on both.
- **i18n (i18next)** — English and Swedish translations.

## How to play

Open the **Game** tab and pick a mode:

- **☕ Practice** — no timer, no pressure. Pick word categories/subcategories and a letter-count range, then guess at your own pace.
- **🏆 Competitive** — a fixed run of multiple words scored end-to-end.
- **⚔️ Duel** — real-time 1v1 against another player: both guess the same secret word simultaneously, scored by correct/present letters, with the match resolved live over a shared session.

Type a guess using the on-screen keyboard (or your computer's keyboard, in the browser) and submit it; the board colors each letter to show whether it's correct, present elsewhere in the word, or absent.

### Logging in

The Game, Progress, and Settings tabs require at least a guest session — tapping into any of them as a first-time visitor shows a "Play as Guest" option (no account needed), alongside Log In / Sign Up. Competitive and Duel modes go a step further and require a full registered account (not just guest).
