# ⚔️ IronQuest

A persistent RPG + card-collecting game where **your body is the character**.
Eating inside a healthy calorie window, hitting your protein target, lifting, and doing cardio
earn XP, coins, and card packs. Nothing resets — every day stacks on the last, like a WoW
character, with an Ultimate Team–style pack and squad meta on top.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer (free).

```bash
cd ironquest
npm install      # first time only
npm start        # builds the app and starts the server
```

Then open **http://localhost:3030**.

- **Windows:** double-click `start-windows.bat`. **Mac:** double-click `start-mac.command`.
- **On your phone:** the server prints a `Phone:` address (e.g. `http://192.168.1.20:3030`).
  Open it on your phone while on the same Wi-Fi, then use "Add to Home Screen" to make it feel like an app.
- Your progress is saved to `ironquest/data/save.json`, with a rolling daily backup in `data/backups/`
  (the last 30 days are kept). There is also an Export/Import button in Settings.
- Different port: `npm start -- --port 4000` (or set `PORT=4000`).
- **Phone + computer:** both read and write the same server save. When you switch back to a device, it pulls the latest copy.
  If a save is ever about to be replaced by a *different* hero or a wiped save, the server first keeps a permanent copy
  in `data/backups/replaced-*.json`.
- The server has no login, so anyone on your Wi-Fi who knows the address can open it. Run it on a home network you trust.

## How the game works

| System | What feeds it | What you get |
|---|---|---|
| **Character level (1–60, then Paragon)** | All skill XP plus every claimed reward | Ranks, zones on the road to the endgame, and coins and packs at milestones |
| **Professions (1–100)** | 🏋️ Ironworking (sets, sessions, PRs) · 🥩 Provisioning (protein) · 🛡️ Discipline (logging, sealing days, calorie window) · 🫀 Endurance (cardio, steps) | Coins every 5 levels, a new tier every 25 (Apprentice, then Journeyman, Expert, Artisan, Grandmaster) |
| **Daily quests** | 4 core quests + 1 rotating bonus quest | XP and coins, plus a Daily Sweep bonus when you finish all of them |
| **Weekly challenges** | 6 Mon–Sun goals (e.g. protein on 5 days, 3 lifts) | Silver packs, plus a Gold pack for finishing all of them |
| **Weekly raid boss** | Every healthy action does damage (a protein day is 1,000, an on-target day 1,200, a workout 600 + 25 per set…) | Gold packs. Each kill makes the next boss tougher |
| **Achievements** | Weight lost, protein and on-target days, streaks, lifts (bench 225, etc.), PRs, volume | Achievement points, titles, coins, and packs |
| **Cards** | Packs (Bronze, Silver, Gold, Elite), bought with coins or earned | 120 collectible heroes in 10 sets. Build a 5-card squad whose rating, perks, and set chemistry boost **every** reward you claim. Duplicates turn into 💎 essence, which crafts the cards you're missing. A legendary is guaranteed within 40 packs |

### Rules that keep it healthy

- **Calorie window, not just a ceiling.** Your target comes from Mifflin-St Jeor TDEE minus your chosen deficit.
  The deficit is capped at 25% and never drops below 1,500 kcal (men) or 1,200 kcal (women).
  Days below the window's minimum **don't** count as wins, because crash dieting costs muscle.
- **Seal the day.** Calorie quests only complete once you seal the day ("I'm done eating"),
  so you can't claim a win at breakfast. If you forget, you can still seal or claim up to 2 days back.
  Sealing an over-target day still earns Discipline XP, because honest logging is the habit that matters.
- **Targets adapt.** Calories and protein are recalculated from your latest weigh-in. You can override both in Settings.
- **Weight progress uses a 7-weigh-in rolling average**, so water-weight swings don't count against you.

### Fast logging

- **Food:** search about 120 common foods (including fast-food staples), tap, set servings, and add.
  Recents and ⭐ My Foods come first. ⭐ **Save meal** turns a whole meal into one tap-to-log favorite.
  📋 **Same as yesterday** copies a meal. Tap any logged item to edit its servings, numbers, or meal. Deleting has **Undo**.
  🧠 **Smart picks** suggests high-protein foods that fit your remaining calories.
- **Training:** "Repeat a past workout" pre-fills last session's weights, so you only type reps.
  Each exercise shows what you did last time. There's a ⏱ rest timer (beeps and vibrates) and support for custom exercises.
- **Body:** daily weigh-ins, steps, and weekly waist measurements. The waist has its own achievement track,
  because it keeps dropping when the scale stalls.

### Staying motivated over months

- The **"Almost There"** panel always shows the nearest goals: the next level, profession milestones, and achievement tiers.
- A **16-week consistency calendar** (on Progress) colors every day: on target + protein, on target, protein hit, over, or logged.
- A **weekly recap** each Monday grades last week's raid, challenges, protein and target days, and weight change.
- **❓ How to Play** in the app explains every system using your own numbers.

## Development

```bash
npm run dev        # Vite dev server on :5173 + API on :3001 (hot reload)
npm test           # unit tests: nutrition math, leveling, quests, raids, packs, pacing simulation
npm run test:e2e   # Playwright browser tests (build first: npm run build)
npm run typecheck
```

The project layout:

- `src/game/`: pure game engine. Everything is derived from your raw logs, so editing or deleting a log just works.
- `src/pages/`, `src/components/`: React UI.
- `src/store/`: Zustand store and save/sync.
- `server/server.mjs`: a zero-dependency Node server that serves the app and stores the save file.

Run `PACING_DEBUG=1 npx vitest run tests/unit/longrun.debug.test.ts` to print a simulated 300-day progression curve.
