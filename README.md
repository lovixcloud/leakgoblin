# LeakGoblin 🛡️

![LeakGoblin image placeholder](./assets/goblin.png)

> **Scan locally. Redact sensitive-looking values. Review before sharing.**

A funny, genuinely useful open-source AI-prompt security CLI. The goblin guard that protects your secrets before you paste into ChatGPT, coding agents, chatbots, or issue trackers.

```
      ,      ,
     /(.-""-.)\
     |\  \/  / |
     | \ /\ /  |
     \  \/  \//
      \  \/  /  
       \____/   
    LeakGoblin 🛡️
```

### Quick Start

```bash
# Install globally (requires Node >=20, recommended 24 LTS)
npm install -g leakgoblin

# Or use without install
npx leakgoblin --help

# Scan text before pasting to AI
cat prompt.txt | leakgoblin scan --stdin
echo "api_key = AKIAIOSFODNN7EXAMPLE" | leakgoblin scan --stdin

# Get sanitized version safe to share
cat prompt.txt | leakgoblin sanitize --stdin > safe_prompt.txt

# Scan a repository
leakgoblin scan .
leakgoblin scan . --format json > report.json

# Quiet mode for CI (exit 1 if secrets found)
leakgoblin scan . --quiet
echo $?  # 0 = clean, 1 = secrets found, 2 = error
```

### Why LeakGoblin?

Developers routinely copy logs, stack traces, `.env` snippets, and terminal output into AI tools. Those snippets often accidentally contain:

- API keys, bearer tokens, GitHub tokens
- Passwords, database credentials
- Private key blocks
- Cloud credentials (AWS, Stripe, Slack, Google)
- Connection strings (`mongodb://`, `postgres://`)
- JWTs and auth headers

LeakGoblin makes this workflow safer **without** accounts, subscriptions, cloud services, or complex config.

**Core promise:** Scan locally → Redact → Review before sharing.

> ⚠️ **Best-effort filter, not a guarantee.** LeakGoblin uses format-specific signatures + conservative heuristics. It cannot identify every possible secret. Always review sanitized output.

### Installation

**Requirements:**
- Node.js >=20.0.0 (recommended: 24 LTS - Active LTS as of Oct 2025, maintained until Apr 2028; Node 22 is Maintenance LTS; Node 20 reached EOL Apr 30 2026)
- npm, yarn, pnpm, or bun

```bash
npm install -g leakgoblin
# or
yarn global add leakgoblin
# or
pnpm add -g leakgoblin
```

**From source:**

```bash
git clone https://github.com/lovixcloud/leakgoblin
cd leakgoblin
npm install
npm run build
npm link  # or npm install -g .
leakgoblin --help
```

**Verify installation:**

```bash
leakgoblin --version
leakgoblin scan --help
echo "test AKIAIOSFODNN7EXAMPLE" | leakgoblin scan --stdin
```

### Usage Examples

#### 1. Scan stdin (most common)

```bash
# Pipe a prompt
cat prompt.txt | leakgoblin scan --stdin

# Output (masked, never shows full secret):
# ⚠️  The goblin found 2 suspicious tokens!
#
#   <stdin>
#     [CRITICAL] Private Key Block (confidence: high) L1:1
#       → -----BEGIN RSA PRIVATE KEY----- [REDACTED]
#     [HIGH] AWS Access Key (confidence: high) L2:10
#       → apiKey = [REDACTED]

# JSON for CI
cat prompt.txt | leakgoblin scan --stdin --format json
```

#### 2. Sanitize stdin

```bash
cat prompt.txt | leakgoblin sanitize --stdin

# Input:
#   api_key = "AKIAIOSFODNN7EXAMPLE"
#   password = "s3cr3tP@ssw0rd"

# Output:
#   api_key = "[REDACTED:API_KEY:aws_access_key]"
#   password = "[REDACTED:PASSWORD:password_assignment]"

# Preserve surrounding text and line breaks
cat examples/prompt_with_secrets.txt | leakgoblin sanitize --stdin
```

#### 3. Scan repository

```bash
# Scan current directory
leakgoblin scan .

# Scan specific path
leakgoblin scan ./src

# Exclude additional patterns
leakgoblin scan . --exclude my-fixtures secrets

# Verbose: show skipped files
leakgoblin scan . --verbose

# JSON report
leakgoblin scan . --format json > leakgoblin-report.json

# CI mode: quiet, exit 1 if secrets found
leakgoblin scan . --quiet
if [ $? -eq 1 ]; then echo "Secrets detected!"; exit 1; fi
```

#### 4. With config file

```bash
# leakgoblin.config.json in repo root or custom path
leakgoblin scan . --config ./leakgoblin.config.json
```

### Configuration

LeakGoblin looks for config in this order:
1. Custom path via `--config`
2. `leakgoblin.config.json` in current dir, then parent dirs
3. `.leakgoblinrc.json` or `.leakgoblinrc`
4. Defaults

**Example `leakgoblin.config.json`:**

```json
{
  "version": 1,
  "exclude": [".git", "node_modules", "dist", "my-fixtures"],
  "severityThreshold": "low",
  "confidenceThreshold": "low",
  "maxFileSizeMB": 5,
  "customPatterns": [
    {
      "id": "internal_token",
      "pattern": "INTERNAL_[A-Z0-9_]{16,}",
      "description": "Internal token format",
      "category": "api_key",
      "severity": "high",
      "confidence": "medium"
    }
  ],
  "allowlist": {
    "files": [],
    "patterns": ["^AKIAIOSFODNN7EXAMPLE$"]
  }
}
```

**Options:**
- `exclude`: additional paths to skip (always excludes .git, node_modules, dist, build, .next, coverage, etc.)
- `customPatterns`: array of custom regex rules
- `severityThreshold`: minimum severity to report (low|medium|high|critical)
- `confidenceThreshold`: minimum confidence (low|medium|high)
- `maxFileSizeMB`: skip files larger than this
- `allowlist`: approved test fixtures (use with care)

See `leakgoblin.config.example.json` for full example.

### What It Detects

| Category | Examples | Confidence |
|----------|----------|------------|
| **Private Keys** | `-----BEGIN RSA PRIVATE KEY-----` | high |
| **Cloud Credentials** | AWS `AKIA...`, `aws_secret_access_key` | high |
| **API Keys** | GitHub `ghp_...`, Stripe `sk_live_...`, Slack `xoxb-...`, Google `AIza...`, OpenAI `sk-...` | high/medium |
| **Bearer / JWT** | `Bearer ...`, `eyJ...` | medium |
| **Passwords** | `password = "..."`, `secret: ...` | medium |
| **Connection Strings** | `mongodb://user:pass@host`, `postgres://...` | high |
| **Env Vars** | `GITHUB_API_KEY=...`, `*_SECRET=...` | high |
| **Heuristic** | Long high-entropy strings | low (labeled as heuristic) |

Each finding includes:
- Type, line number, severity, confidence
- Masked snippet (never full secret)
- File path if scanning repo

### Commands

```
leakgoblin scan [target]     Scan file, directory, or stdin (masked output)
  --stdin                    Read from stdin explicitly
  --format <text|json>       Output format (default: text)
  --exclude <patterns...>     Additional exclusions
  --verbose                  Show skipped files
  --config <path>            Config file path
  --no-color                 Disable colors
  --quiet                    Quiet mode (exit code only)

leakgoblin sanitize          Sanitize stdin, redacting secrets
  --stdin                    Read from stdin (default)
  --no-summary               Don't show summary on stderr
  --config <path>            Config file path

Global:
  --no-color                 Disable colors
  -q, --quiet                Quiet mode
  -c, --config <path>        Config file
  -v, --version              Show version
  -h, --help                 Show help
```

**Exit codes:**
- `0` = No secrets found (or sanitize succeeded)
- `1` = Secrets found (scan)
- `2` = Error (file not found, invalid config, stdin too large, etc.)

### Troubleshooting

**`stdin too large (>10MB)`**
- Use file scan instead: `leakgoblin scan ./large.log`
- Or increase limit via config `maxFileSizeMB`

**`file too large` or `binary file detected` skipped**
- Large/binary files are skipped to avoid performance issues
- Use `--verbose` to see skipped list
- Adjust `maxFileSizeMB` in config

**`Config file not found`**
- Check path: `--config ./my-config.json`
- Ensure JSON is valid: `cat leakgoblin.config.json | jq .`

**Colors not showing / garbled output**
- Use `--no-color` for CI or non-TTY
- Set `NO_COLOR=1` env var (supported by chalk)

**False positives from high-entropy heuristic**
- Heuristic findings are labeled `confidence: low` and `severity: low`
- Raise thresholds: `confidenceThreshold: "medium"` in config
- Or exclude file: add to `exclude` list
- Report false positives with synthetic example (never real secret)

**False negatives (missed secret)**
- Add custom pattern in `leakgoblin.config.json`
- Report with synthetic example of format
- Remember: tool is best-effort, not guarantee

**Installation issues**
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules dist
npm install
npm run build
npm test

# Check Node version
node --version  # should be >=20, recommended 24
```

### Development

```bash
git clone https://github.com/lovixcloud/leakgoblin
cd leakgoblin
npm install
npm run build
npm test
npm run smoke

# Try locally
echo "AKIAIOSFODNN7EXAMPLE" | node ./dist/cli.js scan --stdin
```

**Project structure:**
- `src/cli.ts` - Entry, commander + fallback parser
- `src/commands/` - scan, sanitize commands
- `src/engine/` - detection rules, detector, redactor
- `src/config/` - config loader & validation
- `src/utils/` - fs walk, input, masking (never leak)
- `src/reporting/` - terminal & JSON formatters
- `tests/` - vitest suites (synthetic canary values only)

**Adding a detection rule:** See `CONTRIBUTING.md`

### Security

- **Local-only:** No network requests during scan/sanitize, no upload, no telemetry
- **Never logs secrets:** All output masks secrets with `[REDACTED]`, JSON strips `_rawMatch` and `_secretValue`
- **Synthetic tests only:** All tests use canary values like `AKIAIOSFODNN7EXAMPLE`, never real credentials
- **Best-effort:** Does not claim to find all secrets. Always review sanitized output before sharing to external services.

See `SECURITY.md` for vulnerability reporting and limitations.

### Support & Sponsorship

LeakGoblin is MIT licensed and free to use without donation.

If it saved you from a suspicious copy-paste:

> Saved you from a suspicious copy-paste? Toss the goblin a coffee to help maintain the tool.

- Sponsorship funds support maintenance, test coverage, new detection rules, docs, and security reviews
- No paywall, no hidden features
- Disable donation message: `LEAKGOBLIN_NO_DONATION=1`
- 👉 https://www.patreon.com/lovix

Sponsors are credited below (opt-in).

### Limitations & Honest Disclosures

- **Not a secrets manager:** Does not replace vaults, env encryption, or proper secrets management
- **Pattern matching:** Novel or obfuscated formats may be missed; add custom patterns
- **Heuristic low confidence:** Generic high-entropy detection is heuristic only, not proof of secret
- **No legal advice:** Not a compliance certification
- **Single-user trust:** Assumes you trust your local machine; does not protect against compromised OS

### Roadmap (next priorities)

- [ ] More provider tokens (Azure, GCP, npm, etc.) with high-confidence signatures
- [ ] SARIF output for GitHub Code Scanning
- [ ] `--fix` opt-in that writes sanitized files (explicit, safe)
- [ ] Pre-commit hook example
- [ ] VS Code extension that uses same engine
- [ ] Improved .env and Docker secret detection

Contributions welcome! See `CONTRIBUTING.md`.

### License

MIT - see `LICENSE`

### Credits

Built with:
- Node.js 24 LTS (Active LTS) / 22 LTS (Maintenance) - target >=20
- TypeScript ^5.9.3 (mature, widely compatible; latest is 7.0.2 but 5.9.x is stable)
- commander ^14.0.3 (latest stable CLI framework, verified 2026)
- chalk ^5.6.2 (terminal colors, ESM, maintained)
- vitest ^4.1.10 (tests, latest stable before 5.x which requires Node 22.12)

Inspired by the need to paste safely into AI tools.

---
## 📺 Watch Demo:
[![Watch Demo](https://img.youtube.com/vi/fGm6oAw1SNQ/maxresdefault.jpg)](https://youtu.be/fGm6oAw1SNQ)

**The goblin is watching. Stay vigilant.** 🛡️
