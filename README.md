SimpleSQL

A modern, beginner-friendly SQL learning tool with structured error guidance and simplified syntax support.

SimpleSQL is a desktop SQL IDE built with learning clarity in mind.
It focuses on clean UI, human-readable error explanations, and an optional simplified command mode called SimpleSyntax.

This is not a competitor to enterprise database tools.
It is a structured SQL learning environment.

✨ Core Features
🟦 Standard SQL Mode

Full support for standard SQL queries

Monaco editor integration

Syntax highlighting

Structured error interpretation

Result grid with per-tab isolation

🟢 SimpleSyntax Mode (Learning Mode)

A simplified command layer that translates natural, structured commands into SQL.

Example:

show products all

Translates to:

SELECT * FROM products;

Generated SQL is displayed before execution to help learners understand the mapping.

🧠 Human-Readable Error System

Instead of raw database engine errors, SimpleSQL:

Interprets SQLite error messages

Highlights the exact problematic token in Monaco

Provides structured, calm explanations

Keeps raw logic intact (no silent auto-fixes)

Example:

Raw:

no such column: salery

SimpleSQL:

The column "salery" does not exist. Check spelling or verify the table structure.
📊 Result Management

Each editor tab maintains its own result sheet

Results are tied to the active query tab

Clear indication of active mode and active query

No shared/global result confusion

📥 CSV Import Wizard

Industry-style CSV import with:

File preview

Header detection

Column mapping

Type selection

Strict atomic import

Full rollback on failure

Human-readable import errors

If any row fails validation, no data is imported.

🔄 Database Engine

SimpleSQL uses:

SQLite (via better-sqlite3)

No external server required

No installation setup

Fully self-contained desktop database

Designed for frictionless learning.

🧱 Architecture Highlights

Electron-based desktop app

Monaco editor

Deterministic rule-based error interpreter

Translation layer for SimpleSyntax

Clear separation of:

UI

Execution engine

Error handling

Syntax translation

🟢 SimpleSyntax (Supported Commands v1)

Basic deterministic commands:

SELECT
show products
show products name price
show products where price > 100
show products order by price desc
show products limit 10
Aggregates
count products
sum products price
avg products price
INSERT
add products name="Pen" price=10
UPDATE
update products set price=20 where id=1
DELETE
remove products where id=5

SimpleSyntax is structured, predictable, and not AI-based.

🎯 Philosophy

SimpleSQL is built around three principles:

Learning over complexity

Clarity over cryptic errors

Structure over noise

It is designed to:

Reduce SQL intimidation

Help beginners understand database logic

Provide clean execution feedback

Maintain professional tool behavior

🚀 Why SimpleSQL?

Most SQL tools are designed for engineers and DB administrators.

SimpleSQL is designed for:

Students

Beginners

Business analytics learners

Anyone frustrated by raw SQL errors

It bridges understanding instead of hiding SQL.

📌 Roadmap

AI-enhanced optional error explanations

JOIN support in SimpleSyntax v2

Query history tracking

Performance optimization (virtualized grid)

Schema visualization

📄 License

This project is licensed under the MIT License.
See the [LICENSE](./LICENSE) file for details.

🤝 Open Source Community Files

This repository includes:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)

🛡️ Open-Source Release Checklist (Before Publishing)

Before making the repository public, verify:

- No real credentials or local-only connection details are committed
- No personal/user data is present in committed `data/`, `logs/`, or generated files
- Build artifacts in `release/`, `dist-installer/`, and `build/` are intentionally included or removed
- Local config files are reviewed:
	- `electron/config/connections.json`
	- `server/config/connections.json`
- Temporary test or debug files are reviewed and cleaned if not needed

Recommended quick checks:

```bash
git grep -n -E "(api[_-]?key|token|password|secret|PRIVATE KEY|connectionString)"
git status
```

If any sensitive value exists, rotate credentials and remove them from history before public release.