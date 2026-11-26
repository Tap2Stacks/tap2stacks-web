# Rules for agents and contributors

## Git identity and publishing

- Every commit must use `nvq2309 <nvq2309@gmail.com>` as both author and committer. Configure the identity before committing.
- Enable the repository hooks with `git config core.hooksPath .githooks` (Python 3 is required). The hooks and the push CI check that every commit, and any `Co-authored-by` or `Signed-off-by` trailer, uses this identity.
- Do not use pull requests. Publish only with the nvq2309 GitHub account and explicit permission.
