# Repo setup: the org, secrets, the runner, the first deploy

KIT doc (the same in every game). Moved from the template's README.

## Where games live

Every game is a **private** repo in the GitHub organization
**[diffenderfer-games](https://github.com/diffenderfer-games)** (the host is
[diffenderfer-games/diffenderfer-games](https://github.com/diffenderfer-games/diffenderfer-games)).

1. **Make the game's folder** beside the template and the host repo. Pick the final
   name first: the slug (lowercase `a-z0-9-`) is the folder, the repo and the URL, and
   renaming later means a new folder. In `dg-template`:
   `npm run create -- <slug> --title "My Game" --renderer pixi` (add `--no-online`,
   `--no-turns`… for the features it won't have). It copies the template's last commit,
   runs `new-game` and `npm install`, and makes the first commit. On Windows,
   `tools/New-Game.ps1` does the same and adds a desktop shortcut (it asks for the
   name, or takes `-Name`, `-Renderer`, `-NoOnline`…, `-NoShortcut`, `-NoLaunch`).
2. **The first deploy**, in the new folder: `npm run first-deploy` (below). It creates
   the **private** repo in the org, sets its deploy secrets, pushes and watches the run.
3. **For the hub suites in CI**, the repo (or org) variable `DG_HOST` is the hub
   checkout's path on the runner (and `CHROME_PATH` if Chrome isn't in the default
   place). **It is not set today** (the deploy log shows `DG_HOST:` empty), so the gate
   skips the hub suites with a warning: run `npm run test:hub` locally instead.
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

## The first deploy

```bash
npm run first-deploy                         # the repo, the secrets, the push, then it watches the run
npm run first-deploy -- --dry-run            # print what it would do
npm run first-deploy -- --key ~/.ssh/other_key --no-watch
```

With the GitHub CLI signed in (`gh auth login`), it:

1. creates `diffenderfer-games/<slug>` as a **private** repo (described by `game.description`),
   unless it exists;
2. sets the repo's deploy secrets: `DEPLOY_SSH_KEY` from `~/.ssh/diffenderfer_deploy`
   (`--key` for another file) and `DEPLOY_HOST` (`--host`, default `diffenderfer.games`).
   Each repo has its own copies: org secrets would need a paid plan for private repos.
   Add `DEPLOY_PATH` by hand only when the server folder isn't the repo name;
3. adds the `origin` remote and pushes the current branch: the gate runs, then the
   deploy (below);
4. watches the run to the end (`--no-watch` to skip) and prints the game's URL.

Every step is skipped when it's already done, so it is safe to run again after a
failure. By hand, in the GitHub UI: Settings → Secrets and variables → Actions.

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
