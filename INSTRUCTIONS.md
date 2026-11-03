# Field manual · v0.4.1

Open [CorpoWars](https://qsolkcb.github.io/CorpoWars/) in a WebGL2-capable browser.

## Headquarters

Choose **Research & Loadout** before deploying. You start with **6,000 credits**
and four free issued PDWs. Weapons and research draw from this same budget.
Weapon purchases belong to an agent; re-equipping an owned weapon is free.
Research applies to the whole squad and lasts for the campaign.

| Weapon | Cost per agent | Role |
| --- | ---: | --- |
| Issued PDW | Included | Balanced starter |
| Owen Gun · 9mm | 700 | Rapid automatic fire, 33-round magazine |
| AUG | 1,400 | .223 balance / 9mm speed / .300 Blackout impact |
| Over & Under · 12g | 950 | Two strong close-range shots, 0.7-second base reload |

AUG conversions are fictional game modes. Choose a starting conversion in the
armoury, or cycle selected AUG agents in combat with **B**. A conversion always
requires a complete reload. Weapons fire and reload automatically; reserve ammo
is unlimited, while magazine/reload timing matters.

The research tree has medical chemistry → field surgery, head optics → arm
servos, torso mesh → kinetic legs, and dread amplifier → neural aftershock.
Aftershock also requires head optics. Every node shows its cost and effect.
Medical kits heal selected **living** agents and cannot revive the dead.

**Relaxed** keeps the original forgiving balance. **Hostile** fields four extra
guards with 100 HP, 7 damage, faster movement and a shorter firing interval.
Panic duration is 65% of its normal length in Hostile. Change mode at headquarters;
starting funds and one-time contract rewards are identical. Local best times are
separate by mission and mode.

## Contracts

1. **Hostile Takeover / Breakwater:** disable the relay, steal the ledger, return.
2. **Ghost Shift / Blackglass Foundry:** silence the alarm, recover worker release
   codes and reach the freight gate from a northern insertion.
3. **Boardroom Blackout / Meridian Spire:** disable the executive shield, seize
   the ownership registry and leave through the western service route.
4. **Signal Siege / Copperline Grid:** restore the carrier, transmit for twelve
   uncontested seconds against two security waves, then extract north-east.
5. **Witness Protection / Cold Storage:** unlock the cryostore, release the
   courier and escort them to the western transfer gate.
6. **Golden Parachute / Obsidian Exchange:** cut the failsafe, seize the
   severance fund and extract before the district locks down.

Stand near a terminal to hack it automatically. The first objective unlocks the
second. Extract every surviving agent to win. Contracts pay **2,400 / 3,200 /
4,000 / 4,800 / 5,600 / 7,200 credits on first completion only**. Replays and difficulty changes cannot
farm credits. Agents refit and medical/EMP supplies restock between attempts.

**Signal Siege:** leave a living agent stationary within 1.7 tiles of the
transmitter with clear line of sight. A living guard within three unobstructed
tiles contests the zone unless stunned or afraid. Contest or abandonment drains
progress at half a second per second. Head optics do not accelerate this
twelve-second transmission. Each of the two attack waves spawns once, even if
progress falls back. The zone outline and status bar identify a contest.

**Witness Protection:** the courier becomes vulnerable after release. Press
**Q**, then **C / Escort courier** to assign the squad to accompany them. The
courier follows a route to extraction, moving only while a living agent is
within six tiles with clear line of sight. Escort orders continually guide the
assigned agents ahead along that route; moving, attacking or stopping manually
cancels automatic escort. The extraction objective button also assigns an
escort once the courier is released. Every surviving agent **and the living
courier** must reach the exit. Courier death loses the contract. Medical patches
heal selected agents, not the courier. Their cyan marker, radar and HP readout
keep them identifiable behind buildings.

**Golden Parachute:** the lockdown starts when the first terminal finishes,
giving **180 simulated seconds in Relaxed / 120 in Hostile**. Tactical pause
freezes it. An extraction completed on the deadline wins; otherwise expiration
loses the contract. Plan the escape route before disabling the failsafe.

New districts add **Bulwarks**, slow guards with more HP and 25% bullet armour,
and **Marksmen**, fragile long-range guards with stronger, slower shots. The
broad shield and long-barrel/optic silhouettes distinguish their roles. Existing
weapons, research, EMP and panic remain available to counter them.

## Optional challenges

Every contract has three badges: **Clean Extraction** (all four agents alive),
**Economy of Force** (no medical patches, EMP or emitted panic bursts), and
**Against the Clock** (finish within the headquarters par time). Arming panic
without emitting a burst does not spend the badge. Pause does not advance the
mission clock. Expansion pars are **45 / 35 / 45 seconds**, rewarding a prepared
loadout and direct routing; beating par is optional for a win.

Badges appear in the debrief and headquarters. They accumulate across wins,
separately for each contract and difficulty, and grant no additional credits.
Replays can improve badges without changing one-time payouts.

Purchases and completed contracts save automatically in this browser, when
storage is available. Reloading returns to the briefing; mission positions are
not saved. **New Campaign** requires a second click before resetting progression.
Existing v0.3 campaign saves retain their credits, purchases and completed
contracts. Completing the original three unlocks Signal Siege in headquarters.

## Controls

| Input | Action |
| --- | --- |
| WASD or arrow keys | Pan the camera; left hand stays near the mouse controls |
| Hold the on-screen arrow buttons | Continuous mouse/touch camera pan |
| Middle-button drag | Drag the camera |
| Click the top-left radar | Centre the camera on that map position |
| F / focus button | Smoothly focus selected agents |
| Follow | Keep selected agents in view; manual pan cancels follow |
| Wheel / + / − | Zoom |
| Click or right-click ground | Move selected agents |
| Click an agent / drag a box | Select agents; Shift adds |
| 1–4 / Q | Select one agent / select all |
| Click visible hostile | Approach and focus fire |
| Space / Escape | Tactical pause / stop selected agents |
| M / X | Medical kit / EMP |
| P | Toggle panic field |
| B | Cycle selected AUG conversions (reload required) |
| C / Escort courier | Assign selected living agents to accompany a released courier |
| H / T | Hold fire / building cutaway |
| ? | Field manual |

Panic automatically pulses when an enemy is visible within range of a selected
living agent. Affected enemies **fall back and stop shooting** until fear expires;
they remain hostile. Base radius is 7 tiles, duration 5 seconds and recharge 24
seconds. Research improves these values. Walls block panic. EMP retains its
separate finite charges. Abilities execute only while time is running; orders,
AUG conversion requests and panic arming can be planned during tactical pause.

## Sound and graphics

**Music** enables an original procedural chiptune score. Integer-indexed chord
arpeggios, bass and generated drum noise form a tracker-style arrangement that
changes between briefing, patrol and combat, with a quieter paused arrangement.
**SFX** is independent. The slider controls music volume; audio starts only after
a click. Leaving the tab pauses combat and silences the soundtrack.

Rendering interpolates unit movement between fixed simulation ticks. The frame
rate readout reports the current browser's performance. **Eco** lowers the pixel
ratio on high-density displays. **Cutaway** hides buildings for visibility.
Unsupported WebGL2 devices show an error instead of a blank battlefield.

Agents and security use faceted helmets, tapered armour and articulated limbs.
Muted visor colours distinguish the four agents; Bulwarks retain broad shields,
Marksmen carry long weapons/optics, and the courier carries a hard case. Soft
contact shadows help ground the figures. Selection rings, health indicators,
visibility rules and click targets retain their existing behavior.
