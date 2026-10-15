# Repo setup: the org, secrets, the runner, the first deploy

KIT doc (the same in every game). Moved from the template's README.

## Where games live

Every game is a **private** repo in the GitHub organization
**[diffenderfer-games](https://github.com/diffenderfer-games)** (the host is
[diffenderfer-games/diffenderfer-games](https://github.com/diffenderfer-games/diffenderfer-games)).

1. **Create the repo in the org from this template**:
   [diffenderfer-games/dg-template](https://github.com/diffenderfer-games/dg-template) →
   **Use this template** → Owner **diffenderfer-games**, name = the game's slug
   (lowercase `a-z0-9-`), **Private**. Clone it beside the host repo
   (`git clone https://github.com/diffenderfer-games/<slug>.git`).
   Locally, `tools/New-Game.ps1` makes the folder from this template instead
   (it asks for the name and 2D / 3D / no canvas, runs `npm install` and
   `npm run new-game`); then create an empty private repo in the org and push to it.
2. **Add the deploy secrets to the repo** (Settings → Secrets and variables →
   Actions, or `gh`):
   `gh secret set DEPLOY_SSH_KEY -R diffenderfer-games/<slug> < ~/.ssh/diffenderfer_deploy`
   and `gh secret set DEPLOY_HOST -R diffenderfer-games/<slug> -b diffenderfer.games`
   (`DEPLOY_HOST` defaults to `diffenderfer.games`). Add `DEPLOY_PATH` only when the
   server folder isn't the repo name. Each repo has its own copies: org secrets would
   need a paid plan for private repos.
3. **For the hub suites in CI**, set the repo (or org) variable `DG_HOST` to the
   hub checkout's path on the runner, and `CHROME_PATH` if Chrome isn't in the
   default place. Without `DG_HOST` the gate skips the hub suites with a warning.
4. **The org's self-hosted Windows runner deploys it.** One runner on the owner's
   machine serves every private repo in the org; there is nothing to register.
   GitHub-hosted runners are never used. It runs only for a push to the default
   branch or a manual run, never for pull requests.
5. **Push to `main`/`master`: the first deploy puts it on the host.** When the
   droplet has no clone yet, the deploy clones the repo into `/root/<repo>`,
   runs `npm install`, links it as `/root/diffenderfer-games/apps/<slug>` (slug =
   the repo name lowercased; the repo variable `DEPLOY_SLUG` overrides) and asks
   the host to build it. Later pushes pull, install and rebuild only this game.
   Check `https://diffenderfer.games/<slug>/`. (The manual way: the host's
   [RUNNERS.md](https://github.com/diffenderfer-games/diffenderfer-games/blob/master/RUNNERS.md)
   "New game checklist" and
   [DEPLOY.md](https://github.com/diffenderfer-games/diffenderfer-games/blob/master/DEPLOY.md)
   § 12 "Adding a new game".)

## The deploy workflow

`.github/workflows/deploy.yml` (KIT) has two jobs:

- **check** (the gate): `npm ci`, `npm run check` (typecheck, unit tests, lint,
  format, kit files unchanged, hub-doctor, build), then `npm run test:hub`. A
  manual run can tick `skip_hub_suites`; the skip is logged as a warning with
  who did it. Use it only when the hub test kit itself is broken.
- **deploy-self**: needs `check`; SSHes to the host and rebuilds this game.

Both jobs refuse anything but a push or manual run on the default branch of a
repo in the org. Commits that don't change the game (docs, plans, tooling) can
carry `[skip ci]` in the head commit message to skip the deploy.

**The template repo itself is public.** Public repos never get the org's
self-hosted runner and it has no deploy secrets: both jobs are guarded off
(`if: github.repository != 'diffenderfer-games/dg-template'`), so they run on no
runner at all.

## Hosting locally

Clone the game beside the host repo. `npm run local` (this repo) starts the
host's own `npm run local -- --only <this repo>` on a free port block and
writes the URL to `.tmp/local.json`; see [kit/screenshots.md](kit/screenshots.md#a-local-hub).
The host finds sibling repos under `GitHub/` by itself.
