# Contributing to Mabdel AI

Thank you for your interest in contributing to **Mabdel AI**! We value every contribution, whether it's a bug report, feature suggestion, documentation improvement, or code change.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Branch & Commit Conventions](#branch--commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

---

## How Can I Contribute?

### 🐛 Reporting Bugs
- Search [existing issues](https://github.com/IH-Arik/Mabdel/issues) before creating a new one
- Use the **Bug Report** issue template
- Include steps to reproduce, expected vs actual behavior, and environment details

### 💡 Suggesting Features
- Open a [Feature Request](https://github.com/IH-Arik/Mabdel/issues/new) issue
- Describe the problem you're solving and your proposed solution
- Wait for maintainer approval before investing significant effort

### 📝 Improving Documentation
- Fix typos, improve clarity, add missing examples
- PRs for documentation improvements are always welcome

### 💻 Submitting Code
- Check the [Issues](https://github.com/IH-Arik/Mabdel/issues) for `good first issue` or `help wanted` labels
- Comment on the issue to express your interest before starting work

---

## Development Setup

See the [Getting Started](README.md#-getting-started) section in the main README for full setup instructions.

### Quick Start

```bash
git clone https://github.com/IH-Arik/Mabdel.git
cd Mabdel

# Backend
cd "Mabdel Backend"
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env

# Frontend
cd "../Mabdel Website"
npm install
```

---

## Branch & Commit Conventions

### Branch Naming

```
feature/short-description       → New features
fix/short-description           → Bug fixes
docs/short-description          → Documentation only
refactor/short-description      → Code restructuring
test/short-description          → Tests
chore/short-description         → Maintenance
```

### Commit Messages (Conventional Commits)

```
feat: add AI reply suggestions to conversations
fix: resolve voice recorder not stopping on iOS
docs: update environment variables table
refactor: extract RecordRow into separate component
test: add invoice send reminder test
chore: update dependencies to latest
```

**Format:** `type(scope?): description`

Types: `feat` | `fix` | `docs` | `refactor` | `test` | `chore` | `perf` | `ci`

---

## Pull Request Process

1. **Fork** the repo and create a branch from `master`
2. **Write tests** for any new functionality (backend: pytest, frontend: vitest)
3. **Run the test suite** and ensure all tests pass:
   ```bash
   # Backend
   pytest tests/ -v

   # Frontend
   npm run lint
   ```
4. **Update documentation** if you've changed APIs or added features
5. **Open a Pull Request** using the PR template
6. **Link the related issue** using `Closes #123` in the PR description
7. Maintainers will review within **3–5 business days**
8. Address review feedback and request a re-review

### PR Checklist

- [ ] My code follows the project's code style
- [ ] I have added tests for new functionality
- [ ] All existing tests pass
- [ ] I have updated documentation where necessary
- [ ] My branch is up-to-date with `master`
- [ ] I have linked the related issue

---

## Code Style

### Python (Backend)

- Follow **PEP 8** and use **Black** for formatting (`black app/`)
- Use **isort** for import sorting (`isort app/`)
- Type hints are required on all public functions
- Docstrings for all public modules, classes, and functions
- Max line length: **88** characters (Black default)

```bash
# Format
black app/ tests/
isort app/ tests/

# Lint
flake8 app/ tests/
```

### JavaScript / React (Frontend)

- Use **ESLint** with the project's configuration
- Functional components only (no class components)
- Custom hooks must start with `use`
- Props must be destructured in function signature
- No inline styles — use Tailwind utility classes

```bash
npm run lint
npm run lint -- --fix
```

---

## Reporting Bugs

When reporting a bug, include:

1. **Environment**: OS, Python version, Node version, browser
2. **Steps to Reproduce**: Numbered, minimal steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Screenshots or Logs**: If applicable

---

## Requesting Features

When requesting a feature, include:

1. **Problem Statement**: What problem does this solve?
2. **Proposed Solution**: How should it work?
3. **Alternatives Considered**: What else did you consider?
4. **Additional Context**: Mockups, examples, references

---

Thank you for helping make Mabdel AI better! 🚀
