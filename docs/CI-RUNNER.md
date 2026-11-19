# CI runner

The gate in `.github/workflows/ci.yml` runs on a **self-hosted runner** (Job's own machine),
because the account's GitHub Actions minutes ran out on 2026-11-19. The job asks for the label
`self-hosted`, so any runner registered on `antronic/benkyo-ne` picks it up.

To run on GitHub's machines again, set the repository variable `CI_RUNNER` to `ubuntu-latest`
(Settings → Secrets and variables → Actions → Variables). Delete the variable to go back to the
self-hosted runner. No code change is needed either way.

## Safety

The repository is public. The job only runs for pushes and for pull requests whose branch lives
in this repository; a pull request from a fork is skipped, so a stranger's code never runs on the
machine. Keep it that way, and also keep Settings → Actions → General → "Fork pull request
workflows from outside collaborators" on "Require approval for all outside collaborators".

## What the machine needs

| Need | Why | How to check |
| --- | --- | --- |
| Linux x64 (Ubuntu 22.04/24.04 or Debian 12 is easiest) or macOS | Playwright's Chromium and its system libraries | `uname -a` |
| `git`, `curl`, `tar`, `bash` | checkout and the runner itself | `git --version` |
| About 5 GB free disk | `node_modules`, Node in the tool cache, Chromium, the runner | `df -h ~` |
| Outbound HTTPS to github.com, registry.npmjs.org and the Playwright CDN | checkout, `npm ci`, the Chromium download | |
| Port 4179 free on localhost | `npm run check:layout` serves the build there | `lsof -i :4179` |
| Playwright's system libraries (Linux only) | Chromium will not start without them | see step 3 |

Node does not need to be installed: `actions/setup-node` downloads Node 22 into the runner's tool
cache on the first run. Chromium does not need to be installed by hand either: the workflow runs
`npx playwright install chromium`, which is a no-op once the matching build is in
`~/.cache/ms-playwright`.

## Register a runner

1. Open https://github.com/antronic/benkyo-ne/settings/actions/runners/new, choose the machine's
   OS and architecture, and keep the page open: it shows the download URL and a one-hour
   registration token.
2. On the machine, as a normal user (not root):

   ```sh
   mkdir -p ~/actions-runner && cd ~/actions-runner
   # copy the curl + tar lines from the GitHub page (they carry the current version)
   ./config.sh --url https://github.com/antronic/benkyo-ne --token <TOKEN-FROM-THE-PAGE> \
     --name benkyo-$(hostname) --unattended
   ```

3. Linux only, once: install Chromium's system libraries. This is the only step that needs
   `sudo`. Node is needed for `npx`; any Node 18+ works here.

   ```sh
   sudo npx -y playwright@1.63.0 install-deps chromium
   ```

   Re-run it with the new version when `playwright` in `package-lock.json` moves to a new major
   or minor version and the layout check fails with a missing `.so` library.

4. Run the runner as a service so it survives logouts and reboots:

   ```sh
   cd ~/actions-runner
   sudo ./svc.sh install     # Linux: systemd unit for the current user; macOS: launchd agent
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```

   (Or `./run.sh` in a terminal to try it first.)

5. Check https://github.com/antronic/benkyo-ne/settings/actions/runners: the runner shows
   **Idle**. Re-run the latest CI run, or push to a PR branch, and it turns **Active**.

## When CI waits forever

A job that says "Waiting for a runner to pick up this job" means no runner with the
`self-hosted` label is online. Start the service (`sudo ./svc.sh start`) or the machine. GitHub
cancels a queued job after 24 hours.

## When it fails on the runner but passes locally

- `browserType.launch: ... error while loading shared libraries`: redo step 3.
- `EADDRINUSE :4179`: a previous layout check left `vite preview` running. Find it with
  `lsof -i :4179` and stop that PID (never `pkill`).
- Disk full: clear `~/actions-runner/_work/_tool` of old Node versions and
  `~/.cache/ms-playwright` of old Chromium builds.
