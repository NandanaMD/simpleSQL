# SimpleSQL

SimpleSQL is a desktop SQL learning IDE designed for clarity-first practice. It combines a modern query editor, structured error guidance, and a deterministic learning syntax layer so beginners can understand what SQL is doing, not just run commands.

## Why SimpleSQL

Most database tools are built for experienced engineers and database administrators. SimpleSQL is built for learners who want:

- A cleaner path from beginner queries to standard SQL
- Explanations that are precise and human-readable
- A focused local desktop workflow without external database setup

## Key Features

### Standard SQL Workspace

- Full standard SQL query support
- Monaco-powered editor with syntax highlighting
- Structured error interpretation with token-level guidance
- Per-tab result isolation to avoid result cross-contamination

### SimpleSyntax Learning Mode

SimpleSyntax is a deterministic, rule-based command format that translates into SQL.

Example:

```text
show products all
```

Generated SQL:

```sql
SELECT * FROM products;
```

The translated SQL is shown before execution to reinforce learning.

### Human-Readable Error Guidance

Instead of presenting raw engine output only, SimpleSQL interprets common SQLite errors and explains the likely issue in plain language while preserving the original logic.

Example:

- Raw: no such column: salery
- Explained: The column "salery" does not exist. Check spelling or verify the table structure.

### CSV Import Wizard

- File preview and header detection
- Column mapping and type selection
- Strict atomic import behavior
- Full rollback on failed validation

If any row fails, the import is not committed.

## Technology Stack

- Desktop shell: Electron
- Frontend: React + Vite + Tailwind + Monaco Editor
- API/runtime: Node.js + Express
- Database engine: SQLite via better-sqlite3
- Language: TypeScript

## Architecture Overview

SimpleSQL is organized as a monorepo with clear boundaries:

- client: UI and query interaction layer
- server: Query execution, metadata, import, backups, and API endpoints
- electron: Desktop process and secure preload bridge
- shared: Shared types and contracts

## SimpleSyntax Commands

```text
SELECT
show products
show products name price
show distinct products category
show products name as product_name price as unit_price
show products where price > 100
show products where upper(name) = 'PEN'
show products where (price > 100 or category = 'Office') and stock > 0
show products order by price desc
show products limit 10
show products id union show archived_products id

AGGREGATES
count products
sum products price
avg products price
group orders by customer_id having count(*) > 1

JOIN
join orders customers on customer_id = id
join left orders customers on customer_id = id

INSERT
add products name='Pen' price=10

UPDATE
update products set price=20 where id=1

DELETE
remove products where id=5

SUBQUERIES
show users where id in (show orders customer_id where amount > 1000)

BATCHES
show users limit 5;
show products limit 5;
```

## Getting Started

### Prerequisites

- Node.js 20.x (required)
- npm 9+
- Windows, macOS, or Linux

### Install Dependencies

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

This starts the client and Electron app in development mode.

### Build

```bash
npm run build
```

### Package Desktop App

```bash
npm run package:win
```

Additional options:

- npm run package
- npm run package:mac
- npm run package:linux

## Releases

SimpleSQL uses GitHub Releases as the update source for the desktop auto-updater.

Set a GitHub token (repo scope) before publishing:

```bash
set GH_TOKEN=your_github_token
```

Then run one of:

- npm run release:patch
- npm run release:minor
- npm run release:major

Preview without publishing changes:

```bash
node scripts/release.js patch --dry-run
```

The release script will:

- bump `package.json` version
- build and publish Windows release artifacts
- commit and tag the version
- push commit and tag to GitHub

## Project Philosophy

SimpleSQL is built around three principles:

- Learning over complexity
- Clarity over cryptic errors
- Structure over noise

## Roadmap

- Optional AI-enhanced error explanation layer
- Query history improvements
- Result grid performance optimization
- Schema visualization

## Contributing and Community

- [Contributing Guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)

## License

This project is licensed under the MIT License.
See [LICENSE](./LICENSE) for details.