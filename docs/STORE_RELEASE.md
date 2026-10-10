# Store release checklist

This is everything you need to publish Lumo on **Google Play** and the **App Store**. You don't need a Mac or Android Studio: EAS builds and submits in the cloud.

## 0. One-time accounts

- [ ] [Expo account](https://expo.dev/signup), then run `npm i -g eas-cli && eas login`
- [ ] Apple Developer Program ($99/yr)
- [ ] Google Play Console ($25 one-time). New personal accounts must run a **closed test with 12+ testers for 14 days** before production access.
- [ ] AdMob and RevenueCat accounts (see `docs/MONETIZATION.md` §7)
- [ ] A public **privacy policy URL** (start from `docs/PRIVACY_POLICY.md`) and a support email

## 1. Configure the project

```bash
eas init                       # creates the EAS project; put the id in EAS_PROJECT_ID
eas env:create --environment production --name APP_BUNDLE_ID --value com.yourcompany.lumo
# repeat for every variable in .env.example (ADMOB_*, EXPO_PUBLIC_*)
```

> ⚠️ Choose the bundle id **before your first upload**. It can never change afterwards.

## 2. Build and submit

```bash
npm run build:prod             # Android .aab + iOS .ipa, signing handled by EAS
npm run submit:prod            # uploads to Play (internal track) and TestFlight
```

`appVersionSource: remote` + `autoIncrement` bump build numbers automatically. Raise `VERSION` in `app.config.ts` for each user-facing release.

Ship JS-only fixes without a store review: `eas update --channel production` (requires `expo-updates`; add it with `npx expo install expo-updates`).

## 3. Store listing content

| Field                        | Suggested                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Name                         | Lumo: The Circle Collection                                                  |
| Subtitle (iOS, 30 chars)     | 11 games. Endless circles.                                                   |
| Short description (Play, 80) | 11 circle games. Tap, drag, swipe, draw and battle in one collection.        |
| Category                     | Games → Arcade (or Casual)                                                   |
| Age rating                   | 4+ / Everyone (no violence; ads rated PG via `maxAdContentRating`)           |
| Keywords (iOS)               | one tap,orbit,timing,reflex,arcade,casual,hyper casual,ring,tap game,offline |

**Screenshots:** iPhone 6.9" (1320×2868) and Android phone (1080×1920+). Capture Home, Gameplay mid-run, Missed!, Skins and Results. iPad screenshots are **not** needed (`supportsTablet: false`).

## 4. Privacy forms

**App Store: App Privacy**

- Data used to track you: _Device ID_ (advertising), only if the user allows ATT
- Data linked to you: none
- Data not linked to you: _Purchases_ (RevenueCat), _Coarse location_, _Product interaction_, _Advertising data_, _Crash data_ (AdMob)

**Google Play: Data safety**

- Collected: Device or other IDs, Approximate location, App interactions, Purchase history
- Shared with: Google AdMob (advertising), RevenueCat (purchases)
- Encrypted in transit: yes. Deletion requests: via the support email.
- **Ads:** declare "Contains ads: Yes". **Advertising ID:** declare usage = Advertising.
- Target audience: **13+** (do _not_ select children's ages, or Families policy applies)

## 5. Pre-flight QA (on real devices)

- [ ] First launch: consent form (EU VPN), then the ATT prompt on iOS, then the game
- [ ] 60/120 fps on a low-end Android device, and haptics and sounds work (silent switch respected)
- [ ] Backgrounding mid-run pauses; Android back pauses, then quits
- [ ] Continue after a rewarded ad, Double coins, Free coins (cap 5 a day)
- [ ] Interstitial only after run 4+, then no more than one per 3 runs / 2 min
- [ ] Sandbox purchases for all 5 products; Restore on a fresh install; Remove Ads hides interstitials
- [ ] Airplane mode: the game is fully playable, with ads and shop failing gracefully
- [ ] Large text / VoiceOver / TalkBack can start a run

## 6. After launch

- Watch crashes (Play Vitals / Xcode Organizer). Consider adding `@sentry/react-native`.
- Watch D1 retention before buying any user acquisition.
- Iterate on `AdPacing`, `ECONOMY` and skin prices. They're all constants in one place.

Default collection: 11 games and 22 visible achievements. Maze, Duel and Chain are deferred ideas (DEFERRED_GAMES.md), not release features. Recapture overview/achievement screenshots for this catalog before submission.
