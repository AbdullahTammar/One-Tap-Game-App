# Monetization strategy: free-to-play Lumo

Lumo is free on both stores. Revenue comes from **ads that players choose to watch**, a few **small ads they can't skip**, and **optional purchases**. The rule behind every choice below is _protect retention first_. A player who quits on day 1 earns $0, and a player who stays 30 days is where almost all the revenue comes from.

## 1. Revenue streams (already built into the app)

| #   | Stream                                           | Where it appears                                        | Why it works                                                                                                                   |
| --- | ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Rewarded ad: Continue run**                    | "Missed!" sheet and Results screen (one per run)        | The highest-intent moment in the game: "I was so close!" Typically the #1 earner in hyper-casual games.                        |
| 2   | **Rewarded ad: Double coins**                    | Results screen, when Continue isn't available           | Speeds up skin unlocks. Watching is the player's choice, so it feels like a gift.                                              |
| 3   | **Rewarded ad: Free coins** (+60, up to 5 a day) | Shop                                                    | A daily habit. Players who can't pay still feed the coin economy.                                                              |
| 4   | **Interstitial ads**                             | Between runs, when the player taps Retry or Results     | Steady baseline income. Paced conservatively (see §2).                                                                         |
| 5   | **Remove Ads** (one-time, ~$2.99)                | Shop, Settings                                          | The classic purchase. Players who are annoyed by ads become payers. Rewarded ads stay available because players opt into them. |
| 6   | **Starter Pack** (~$3.99: no ads + 2,500 coins)  | Top of the Shop, highlighted                            | Anchors value. Most "Remove Ads" buyers upgrade to this for $1 more.                                                           |
| 7   | **Coin packs** ($0.99 / $4.99 / $9.99)           | Shop, and the "Get N more coins" button on locked skins | Lets dedicated players buy the premium glowing skins (Nova, Abyss, Prism).                                                     |

Ads: **Google AdMob** (`react-native-google-mobile-ads`) with Google UMP consent and Apple ATT.
Purchases: **RevenueCat** (`react-native-purchases`), which handles receipt validation for both stores, refunds, analytics and restores.

## 2. Ad pacing (`src/services/config.ts → AdPacing`)

- **No interstitials in the first 3 runs**, so new players never see an ad before they're hooked.
- After that, at most one interstitial **every 3 runs** and **never within 120 s** of the previous one.
- Never mid-run. Never on app open. No banners covering the game.
- Paying players (Remove Ads or Starter Pack) never see interstitials.

Tune these numbers after launch using real retention data. A/B test `runsBetween` = 2, 3 or 4.

## 3. Coin economy (`src/game/constants.ts → ECONOMY`, `src/game/skins.ts`)

- Earn: 1 coin per 2 gates, +50 for the daily goal (30 gates), +60 for each free-coins ad, plus doubled coins.
- Spend: 9 standard skins (400 to 1,500) and 3 premium glowing skins (2,500 to 5,000).
- An engaged non-payer unlocks a new skin roughly every 2 to 4 days, which keeps them coming back. Premium skins take weeks without buying, which gives coin packs a reason to exist.

## 4. Retention features that multiply ad revenue

- **Daily goal + streak** on Home (built in).
- **Ranks ladder** (Spark → Lumo) and a personal top 10 (built in).
- **Rating prompt** only after a new personal best, for players with 8+ games, at most once per 90 days (built in).
- **Share score** from Results, for free organic installs (built in).

## 5. Roadmap: next earners, in order of expected value

1. **Lumo+ subscription** (~$1.99/week or $4.99/month): no ads, 2× coins, an exclusive monthly skin. RevenueCat already supports it, so this needs only an entitlement and one screen.
2. **Season pass** (free track + $4.99 premium track) of skins unlocked by gates cleared.
3. **Online leaderboards** (Game Center / Google Play Games) and friend challenges, for virality.
4. **Ad mediation** (AppLovin MAX or AdMob mediation with Meta, Unity and others). This usually adds +20–40% eCPM once you have 5k+ daily users.
5. **Daily login calendar** and **limited-time skins** (FOMO drops on weekends).
6. **Localization** (Arabic, Spanish, Portuguese, Hindi, Indonesian): big, cheap-to-acquire markets.

## 6. KPIs to watch (RevenueCat + AdMob + store consoles)

| KPI                                  | Healthy target for a hyper-casual game |
| ------------------------------------ | -------------------------------------- |
| D1 / D7 / D30 retention              | 40% / 15% / 5%                         |
| Rewarded views per daily active user | 2–4                                    |
| Interstitials per DAU                | 2–5                                    |
| ARPDAU                               | $0.03–0.10                             |
| Payer conversion                     | 0.5–2%                                 |

## 7. Launch setup checklist

1. **AdMob**: create two apps (iOS and Android), then for each create a _Rewarded_ and an _Interstitial_ unit. Put the IDs in EAS environment variables (see `.env.example`). Add your `app-ads.txt` to your website.
2. **AdMob → Privacy & messaging**: create a **GDPR** message and a **US states** message. The app shows them automatically.
3. **App Store Connect / Play Console**: create the in-app products with these **exact IDs**:
   `lumo_remove_ads` (non-consumable), `lumo_starter_pack` (non-consumable),
   `lumo_coins_1000`, `lumo_coins_6000`, `lumo_coins_15000` (consumable).
4. **RevenueCat**: create a project, connect both stores, import the products, and copy the public SDK keys into `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
5. Fill in the **data-safety / privacy nutrition labels**. AdMob collects device identifiers and coarse location for advertising. See `docs/STORE_RELEASE.md`.
