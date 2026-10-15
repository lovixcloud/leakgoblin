#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Lightweight CLI without hard dependency on commander for offline/fallback
let Command = null;
let chalk = null;
try {
    const commanderMod = await import('commander').catch(() => null);
    if (commanderMod) {
        Command = commanderMod.Command;
    }
}
catch { }
try {
    const chalkMod = await import('chalk').catch(() => null);
    if (chalkMod) {
        chalk = chalkMod.default || chalkMod;
    }
}
catch { }
// Fallback minimal implementations if deps not installed
if (!chalk) {
    chalk = {
        red: (s) => s,
        green: (s) => s,
        yellow: (s) => s,
        cyan: (s) => s,
        gray: (s) => s,
        bold: (s) => s,
        magenta: (s) => s,
    };
}
function getVersion() {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // dist/cli.js -> ../package.json
        const pkgPath = path.resolve(__dirname, '../package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        return pkg.version || '0.1.1.0';
    }
    catch {
        return '0.1.1.0';
    }
}
const VERSION = getVersion();
const GOBLIN_BANNER = `
  ,      ,
 /(.-""-.)\\
 |\\  \\/  / |
 | \\ /\\ /  |
 \\  \\/  \\/  /
  \\  \\/  /
   \\____/
 LeakGoblin v${VERSION} 🛡️
 Scan locally. Redact. Review before sharing.
`;
async function main() {
    // If commander is available, use it
    if (Command) {
        const program = new Command();
        program
            .name('leakgoblin')
            .description('Scan locally. Redact sensitive values. Review before sharing. A goblin guard for your secrets.')
            .version(VERSION, '-v, --version', 'output the current version')
            .option('--no-color', 'disable colors')
            .option('-q, --quiet', 'quiet mode - only exit codes')
            .option('-c, --config <path>', 'path to config file');
        program
            .command('scan')
            .description('Scan text or repository for potential secrets (masked output)')
            .argument('[target]', 'file or directory to scan (default: stdin if no target, or use --stdin)', '')
            .option('--stdin', 'read from stdin explicitly')
            .option('--format <format>', 'output format: text or json', 'text')
            .option('--exclude <patterns...>', 'additional exclude patterns')
            .option('--verbose', 'verbose output including skipped files')
            .action(async (target, opts) => {
            const globalOpts = program.opts();
            const { scanCommand } = await import('./commands/scan.js');
            const result = await scanCommand(target || undefined, {
                stdin: opts.stdin || !target,
                format: opts.format,
                noColor: globalOpts.color === false,
                quiet: globalOpts.quiet,
                verbose: opts.verbose,
                config: globalOpts.config,
                exclude: opts.exclude,
                showAscii: !globalOpts.quiet,
            });
            if (result.output) {
                if (opts.format === 'json') {
                    console.log(result.output);
                }
                else {
                    // text goes to stdout, but we use console.log which is stdout
                    process.stdout.write(result.output + '\n');
                }
            }
            // Donation message - only after result, and disableable
            if (!globalOpts.quiet && process.env.LEAKGOBLIN_NO_DONATION !== '1') {
                console.error('');
                console.error(chalk.gray('Saved you from a suspicious copy-paste? Toss the goblin a coffee to help maintain the tool.'));
                console.error(chalk.gray('Sponsor config: .github/FUNDING.yml (set your own links) | Disable: LEAKGOBLIN_NO_DONATION=1'));
            }
            process.exit(result.exitCode);
        });
        program
            .command('sanitize')
            .description('Sanitize text from stdin, redacting secrets while preserving structure')
            .option('--stdin', 'read from stdin (default)')
            .option('--no-summary', 'do not show summary on stderr')
            .action(async (opts) => {
            const globalOpts = program.opts();
            const { sanitizeCommand } = await import('./commands/sanitize.js');
            const result = await sanitizeCommand({
                stdin: true,
                noColor: globalOpts.color === false,
                quiet: globalOpts.quiet,
                config: globalOpts.config,
                showSummary: opts.summary !== false,
            });
            if (result.stderr && !globalOpts.quiet) {
                process.stderr.write(result.stderr + '\n');
            }
            if (result.output) {
                process.stdout.write(result.output);
            }
            if (!globalOpts.quiet && process.env.LEAKGOBLIN_NO_DONATION !== '1') {
                if (result.output) {
                    console.error('');
                    console.error(chalk.gray('Saved you from a suspicious copy-paste? Toss the goblin a coffee to help maintain the tool.'));
                }
            }
            process.exit(result.exitCode);
        });
        // Default action: if no command, show help or scan stdin if piped
        program.action(async () => {
            if (!process.stdin.isTTY) {
                // Piped input with no command -> assume scan --stdin
                const globalOpts = program.opts();
                const { scanCommand } = await import('./commands/scan.js');
                const result = await scanCommand(undefined, {
                    stdin: true,
                    format: 'text',
                    noColor: globalOpts.color === false,
                    quiet: globalOpts.quiet,
                    config: globalOpts.config,
                    showAscii: !globalOpts.quiet,
                });
                if (result.output)
                    process.stdout.write(result.output + '\n');
                process.exit(result.exitCode);
            }
            else {
                console.log(GOBLIN_BANNER);
                program.help();
            }
        });
        await program.parseAsync(process.argv);
        return;
    }
    // Fallback CLI without commander - manual parsing
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
        console.log(GOBLIN_BANNER);
        console.log(`
Usage: leakgoblin <command> [options]

Commands:
  scan [target]     Scan file, directory, or stdin for secrets
  sanitize         Sanitize stdin, redacting secrets

Options:
  -v, --version    Show version
  --no-color       Disable colors
  -q, --quiet      Quiet mode (exit code only)
  -c, --config <path>  Config file path
  --format <fmt>   Output format: text or json (scan only)
  --stdin          Read from stdin explicitly

Examples:
  leakgoblin scan .
  cat prompt.txt | leakgoblin scan --stdin
  cat prompt.txt | leakgoblin sanitize --stdin
  leakgoblin scan . --format json
  leakgoblin --help

Exit codes:
  0 = no secrets found, 1 = secrets found, 2 = error

Docs: https://github.com/lovixcloud/leakgoblin
`);
        process.exit(0);
    }
    if (args.includes('--version') || args.includes('-v')) {
        console.log(VERSION);
        process.exit(0);
    }
    const noColor = args.includes('--no-color');
    const quiet = args.includes('--quiet') || args.includes('-q');
    const formatJson = args.includes('--format') && args[args.indexOf('--format') + 1] === 'json';
    const target = args.find(a => !a.startsWith('-') && a !== 'scan' && a !== 'sanitize') || undefined;
    const command = args[0];
    if (command === 'scan' || !['sanitize'].includes(command)) {
        const { scanCommand } = await import('./commands/scan.js');
        const result = await scanCommand(target, {
            stdin: !target || args.includes('--stdin'),
            format: formatJson ? 'json' : 'text',
            noColor,
            quiet,
            showAscii: !quiet,
        });
        if (result.output) {
            process.stdout.write(result.output + (result.output.endsWith('\n') ? '' : '\n'));
        }
        process.exit(result.exitCode);
    }
    else if (command === 'sanitize') {
        const { sanitizeCommand } = await import('./commands/sanitize.js');
        const result = await sanitizeCommand({
            stdin: true,
            noColor,
            quiet,
            showSummary: !args.includes('--no-summary'),
        });
        if (result.stderr && !quiet)
            process.stderr.write(result.stderr + '\n');
        if (result.output)
            process.stdout.write(result.output);
        process.exit(result.exitCode);
    }
}
main().catch(err => {
    console.error('Unexpected error:', err.message || err);
    process.exit(2);
});
//# sourceMappingURL=cli.js.map
