# WordseNative

Wordse is a Wordle-style word-guessing game — guess the secret word letter by letter, with feedback on which letters are correct, present, or absent. WordseNative is the mobile/web port, playable on iOS, Android, and in the browser.

## Tech stack

- **Expo / React Native** — cross-platform app (iOS, Android), with [react-native-web](https://necolas.github.io/react-native-web/) powering the browser version from the same codebase.
- **Supabase** — backend for authentication, word data, scores, and realtime multiplayer.
- **React Navigation** — bottom-tab navigation (Home, Game, Progress, Profile, About) plus full-screen auth/settings flows.
- **i18n (i18next)** — English and Swedish translations.

## How to play

Open the **Game** tab and pick a mode:

- **☕ Practice** — no timer, no pressure. Pick word categories/subcategories and a letter-count range, then guess at your own pace.
- **🏆 Competitive** — a fixed run of multiple words scored end-to-end.
- **⚔️ Duel** — real-time 1v1 against another player: both guess the same secret word simultaneously, scored by correct/present letters, with the match resolved live over a shared session.

Type a guess using the on-screen keyboard and submit it; the board colors each letter to show whether it's correct, present elsewhere in the word, or absent.

### Logging in

Practice mode works with no account at all — tap **Start Playing** and go, though scores aren't saved without at least a guest session. Competitive and Duel modes require a full registered account (not just guest). Use the **Log In** link in the top-right corner to sign in, register, or continue as a guest.
