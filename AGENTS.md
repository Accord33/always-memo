# Repository Guidelines

## Project Structure & Module Organization
This repository is currently minimal and centered on documentation. Keep top-level policy/docs files in the root (for example, `AGENTS.md`).

When application code is added, use a predictable layout:
- `src/` for production code
- `tests/` for automated tests
- `assets/` for static files (images, sample data, fixtures)
- `scripts/` for local automation tasks

Use small, focused modules and keep file names descriptive (for example, `memo_store.py`, `test_memo_store.py`).

## Build, Test, and Development Commands
No build system is configured yet. Add project commands as tooling is introduced, and keep them documented in this file.

Recommended baseline once tooling is added:
- `make setup` to install dependencies
- `make test` to run the full test suite
- `make lint` to run formatting/lint checks
- `make dev` to start a local development workflow

If `Makefile` is not used, provide equivalent `npm`, `pytest`, or language-native commands.

## Coding Style & Naming Conventions
Use consistent formatting and automate it with a formatter/linter for the project language.
- Indentation: 2 spaces for JSON/YAML, 4 spaces for Python, language defaults elsewhere
- Naming: `snake_case` for files/functions in Python; `camelCase` for JavaScript variables/functions; `PascalCase` for classes
- Keep functions short and single-purpose

Prefer explicit, readable code over compact but unclear patterns.

## Testing Guidelines
Place tests under `tests/` and mirror source paths where practical.
- Name test files with `test_*.py` or `*.test.ts` (matching the chosen stack)
- Write unit tests for new logic and regression tests for bug fixes
- Target meaningful coverage of changed code before opening a PR

## Commit & Pull Request Guidelines
No repository commit history is available yet, so use Conventional Commits moving forward:
- `feat: add memo persistence layer`
- `fix: handle empty note titles`
- `docs: update setup instructions`

PRs should include:
- Clear summary of what changed and why
- Linked issue/task when applicable
- Test evidence (command + result)
- Screenshots/log excerpts for UI or behavior changes
