import { Link } from 'react-router-dom';
import { useView } from '../store/store';
import { BONUS_DAILIES, CORE_DAILIES, DAILY_SWEEP, WEEKLIES, WEEKLY_SWEEP } from '../game/quests';
import { DAMAGE_RULES, RAID_BASE_HP } from '../game/raid';
import { PACKS, PITY_LIMIT, RARITY_INFO, RARITIES } from '../game/cards';
import { SKILL_INFO } from '../game/engine';
import { CHAR_MAX_LEVEL } from '../game/leveling';
import { fmt } from '../lib/format';
import { Rewards } from '../components/ui';

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>
          {icon} {title}
        </h2>
      </div>
      <div className="stack small guide">{children}</div>
    </div>
  );
}

export function Guide() {
  const view = useView();
  const t = view.todayStats.targets;
  return (
    <div>
      <div className="page-title">
        <div>
          <h1>❓ How to Play</h1>
          <p>Your body is the character. Here's exactly how every system works.</p>
        </div>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        <Section icon="🔁" title="The daily loop (2 minutes a day)">
          <ol style={{ margin: 0, paddingLeft: 20 }} className="stack">
            <li>
              <b>Log food as you eat</b> on the <Link to="/food">Food</Link> page. Search, tap, add. Recents and ⭐ saved meals make repeat meals one tap.
            </li>
            <li>
              <b>Log training</b> on <Link to="/train">Train</Link>: lifts (weight × reps), cardio minutes, steps, and your weigh-in.
            </li>
            <li>
              <b>Seal the day</b> when you're done eating. That locks in the calorie quests. Forgot? You can seal or claim up to 2 days back.
            </li>
            <li>
              <b>Claim rewards</b> (the gold 🎁 button), <b>open packs</b>, and improve your <Link to="/cards">squad</Link>.
            </li>
          </ol>
        </Section>

        <Section icon="🎯" title="Your targets">
          <div className="tiles">
            <div className="tile">
              <div className="k">Calorie window</div>
              <div className="v">
                {fmt(t.calorieMin)}–{fmt(t.calories)}
              </div>
            </div>
            <div className="tile">
              <div className="k">Protein</div>
              <div className="v">{t.protein} g</div>
            </div>
            <div className="tile">
              <div className="k">Maintenance</div>
              <div className="v">{fmt(t.tdee)}</div>
            </div>
          </div>
          <p>
            Your <b>maintenance</b> estimate is Mifflin-St Jeor × your activity level. The top of the window is maintenance minus your chosen deficit. The deficit is capped at
            25% and never takes you below {fmt(t.floor)} kcal. Days <b>below</b> the window don't count as wins, because under-eating costs muscle and doesn't last. Targets
            update automatically as your weigh-ins drop. You can override them in <Link to="/settings">Settings</Link>.
          </p>
          <p>
            <b>Protein</b> defaults to about 0.9 g per lb of goal weight. That's the range shown to preserve muscle while cutting and to build it while training.
          </p>
        </Section>

        <Section icon="⬆️" title={`Character level (1–${CHAR_MAX_LEVEL}) & professions (1–100)`}>
          <p>
            Your character XP is the total of your four professions plus the XP from every reward you claim. Each level unlocks coins, packs every 5 levels, new ranks, and
            new zones on the road to {CHAR_MAX_LEVEL}. After that, endless Paragon levels each give a Gold pack.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {Object.values(SKILL_INFO).map((s) => (
              <li key={s.name}>
                {s.icon} <b>{s.name}</b>: {s.blurb}
              </li>
            ))}
          </ul>
          <p>Every 5 profession levels pays coins. Every 25 promotes you to a new tier (Journeyman, then Expert, Artisan, and Grandmaster) and gives a Gold pack.</p>
        </Section>

        <Section icon="📜" title="Quests">
          <p>
            <b>Daily:</b> four core quests plus one rotating bonus quest. Finish all five for the {DAILY_SWEEP.title} bonus.
          </p>
          <div className="stack" style={{ gap: 6 }}>
            {CORE_DAILIES.map((q) => (
              <div key={q.key} className="row between">
                <span>
                  {q.icon} <b>{q.title}</b> {q.needsSeal && <span className="pill gold">needs seal</span>}
                </span>
                <Rewards xp={q.xp} coins={q.coins} packs={[]} />
              </div>
            ))}
            <div className="row between">
              <span className="muted">Bonus rotation: {BONUS_DAILIES.map((q) => `${q.icon} ${q.title}`).join(' · ')}</span>
            </div>
          </div>
          <p>
            <b>Weekly (Mon–Sun):</b> {WEEKLIES.map((q) => q.title).join(', ')}. Finish all six for {WEEKLY_SWEEP.title}:{' '}
            <Rewards xp={WEEKLY_SWEEP.xp} coins={WEEKLY_SWEEP.coins} packs={WEEKLY_SWEEP.packs} />
          </p>
        </Section>

        <Section icon="🐉" title="Weekly raid boss">
          <p>
            A new boss appears every Monday with {fmt(RAID_BASE_HP)} HP. Each one you defeat makes the next one 5% tougher, up to double. Everything healthy you do deals damage:
          </p>
          <div className="grid two" style={{ gap: 6 }}>
            {DAMAGE_RULES.map((r) => (
              <div key={r.key} className="row between" style={{ padding: '4px 10px', background: '#12162c', borderRadius: 8 }}>
                <span>{r.label}</span>
                <b className="red">{r.per}</b>
              </div>
            ))}
          </div>
          <p>Each kill drops a Gold pack, plus an Elite pack every 4th kill, along with XP and coins that grow with the boss tier.</p>
        </Section>

        <Section icon="🃏" title="Cards, packs & your squad">
          <p>
            There are 120 heroes across 10 sets. Put 5 in your <b>squad</b> and they boost <b>every reward you claim</b>:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <b>Team rating:</b> each point above 60 gives +0.5% XP. Empty slots count as 0, so fill all five.
            </li>
            <li>
              <b>Perks:</b> Uncommon and better cards add % XP, % coins, or % coins for a quest category.
            </li>
            <li>
              <b>Chemistry:</b> 3 cards from the same set give +5% coins. 5 from one set give +10% coins and +5% XP.
            </li>
            <li>
              <b>Duplicates</b> melt into 💎 essence, which crafts any card you're missing. Completing a set pays 2,500 coins and an Elite pack.
            </li>
          </ul>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
            {(Object.keys(PACKS) as (keyof typeof PACKS)[]).map((k) => (
              <div key={k} className="tile">
                <b style={{ color: PACKS[k].color }}>{PACKS[k].label}</b>
                <div className="tiny muted">
                  🪙 {fmt(PACKS[k].cost)} · {PACKS[k].cards} cards
                </div>
                {RARITIES.map((r) => (
                  <div key={r} className="row between tiny">
                    <span style={{ color: RARITY_INFO[r].color }}>{RARITY_INFO[r].label}</span>
                    <span>{PACKS[k].odds[r]}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p>A Legendary is guaranteed within {PITY_LIMIT} packs.</p>
        </Section>

        <Section icon="💡" title="Tips that actually move the needle">
          <ul style={{ margin: 0, paddingLeft: 20 }} className="stack">
            <li>Front-load protein. A 30 g+ breakfast makes the rest of the day easy, and it's a recurring bonus quest.</li>
            <li>Weigh in most mornings and judge the 7-day trend, not single days. Water swings of 2–4 lb are normal.</li>
            <li>Measure your waist weekly. When the scale stalls while you're lifting, the tape often keeps moving.</li>
            <li>Progressive overload: beat last time by one rep or 5 lb. Every PR is +75 XP and 300 raid damage.</li>
            <li>Steps are the most underrated fat-loss tool. 7k+ steps completes "Answer the Call" even on rest days.</li>
            <li>Honest logging beats perfect logging. Sealing an over-target day still earns Discipline XP and raid damage.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
