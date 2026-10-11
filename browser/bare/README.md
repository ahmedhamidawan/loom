# orbit-browser bare flavor

`@galaxyproject/orbit-browser` mounted with nothing added: no tools, skills or artifact kinds of
its own, no session store, and the default launch on the current history. It is never published.

It exists so the core is tested as something other than Olit. `src/surface.test.ts` pins what the
core alone sends a model, so a change to the core's prompt or tools shows up here for every flavor,
and `e2e/bare-drive.cjs` checks that it boots and answers a turn. If either breaks, or the snapshot
starts naming something this flavor doesn't have, the core has picked up an assumption about a
particular flavor. See ../LAYOUT.md.

    GALAXY_ROOT=... LLM_PROVIDER=... npm run dev -w @galaxyproject/orbit-browser-bare   # :5174
