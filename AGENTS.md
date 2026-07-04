# Project Instructions

This repository is connected to Lovable. Changes made locally are not visible in
Lovable until they are committed and pushed to the connected GitHub repository.

When asked to make code changes in this project:

1. Keep edits focused on the requested behavior.
2. Run the relevant validation, with `npx tsc --noEmit` as the minimum for
   TypeScript changes.
3. Commit the completed changes to the current branch.
4. Push the branch to `origin`, normally `origin/main`.
5. If push is rejected because the remote moved, fetch, review the incoming
   commits, rebase the local commit on top of `origin/main`, rerun validation,
   and push again.
6. Report the final commit hash and whether the branch is aligned with
   `origin/main`.

Do not force-push unless the user explicitly requests it.
