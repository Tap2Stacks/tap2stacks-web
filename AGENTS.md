# Rules for agents and contributors

## Git identity and publishing

- Every commit must use `nvq2309 <nvq2309@gmail.com>` as both author and committer. Configure the identity before committing.
- Enable the repository hooks with `git config core.hooksPath .githooks` (Python 3 is required). The hooks and push CI check identities and block retired product names and former account identifiers in files, paths, refs, and commit messages.
- Do not use pull requests. Publish only with the approved nvq2309 GitHub account and explicit permission; stop if that account is unavailable.
