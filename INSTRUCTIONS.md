# Field manual · v0.3.0

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

Stand near a terminal to hack it automatically. The first objective unlocks the
second. Extract every surviving agent to win. Contracts pay **2,400 / 3,200 /
4,000 credits on first completion only**. Replays and difficulty changes cannot
farm credits. Agents refit and medical/EMP supplies restock between attempts.

Purchases and completed contracts save automatically in this browser, when
storage is available. Reloading returns to the briefing; mission positions are
not saved. **New Campaign** requires a second click before resetting progression.

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
