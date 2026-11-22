# Rules for agents and contributors

- Every commit must be authored by nvq2309 <nvq2309@gmail.com>. Before committing, run `git config user.name nvq2309` and `git config user.email nvq2309@gmail.com`.
- `.githooks/pre-commit` blocks any other author locally (enable it with `git config core.hooksPath .githooks`), and the Commit author workflow fails CI on any commit by another author.
