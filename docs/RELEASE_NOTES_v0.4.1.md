# CorpoWars v0.4.1 — Human Resources

The squad and corporate security have acquired a few more angles.

- Rounded, faceted helmets with shaped visors replace rectangular heads.
- Tapered armour, sloped shoulders, individual boots and articulated walking
  limbs give agents and guards a clearer human silhouette.
- Each agent has an individual visor accent. Bulwarks carry a curved shield;
  marksmen have a longer rifle and optic; the courier carries a chamfered case.
- Soft contact shadows anchor the figures to the streets.

The detail fits inside a smaller vertex budget: 288 vertices for an agent or
guard instead of 300, 336 instead of 354 for a bulwark, 312 instead of 336 for
a marksman, and 276 instead of 300 for the courier. Existing shaders, draw
passes, GPU buffers, camera, selection and tactical overlays remain in use.
There are no new runtime dependencies, textures or asset downloads.

All six contracts, challenges, controls, combat balance and existing saves
continue unchanged. This is a presentation update.

84 Node tests cover the game and renderer, including eight 120-frame comparisons
against v0.4.0. CI also runs native before/after galleries, environment pixel
comparisons and packaged browser playthroughs of all six contracts.
See [VISUAL_POLISH.md](VISUAL_POLISH.md) for reproducible measurements and limits:
active modeled CPU workloads improve, GPU submission budgets do not grow, but
lazy templates add a small first-use cost and bounded CPU memory. These results
are not a guarantee of unchanged FPS on every physical device.
