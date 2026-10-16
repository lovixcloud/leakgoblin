import type { Finding, ScanResult } from '../engine/types.js';
import { truncateForDisplay } from '../utils/masking.js';

export interface FormatOptions {
  noColor?: boolean;
  showAscii?: boolean;
}

let chalk: any = null;
try {
  // Dynamic import - may not be available in all envs
  const mod = await import('chalk').catch(() => null);
  if (mod) chalk = mod.default || mod;
} catch {}

function colorize(text: string, color: string, noColor?: boolean): string {
  if (noColor || !chalk) return text;
  try {
    if (color === 'red') return chalk.red(text);
    if (color === 'yellow') return chalk.yellow(text);
    if (color === 'green') return chalk.green(text);
    if (color === 'cyan') return chalk.cyan(text);
    if (color === 'gray') return chalk.gray(text);
    if (color === 'bold') return chalk.bold(text);
    if (color === 'magenta') return chalk.magenta(text);
  } catch {}
  return text;
}

const GOBLIN_ASCII = `
      ,      , 
     /(.-""-.)\\
     |\  \/  / |
     | \ /\\ / |
     \  \/  \//
      \  \/  /  
       \____/   
    LeakGoblin 🛡️
`;

export function formatFindings(result: ScanResult, options: FormatOptions = {}): string {
  const { findings, scannedFiles, skippedFiles, errors } = result;
  const noColor = options.noColor;

  let out = '';

  if (options.showAscii && !noColor) {
    out += colorize(GOBLIN_ASCII, 'cyan', noColor) + '\n';
  }

  if (findings.length === 0) {
    out += colorize('✓ No matching secrets detected. Stay vigilant.', 'green', noColor) + '\n';
    out += colorize('  The goblin checked ' + (scannedFiles ?? 0) + ' files and found nothing suspicious.', 'gray', noColor) + '\n';
    return out;
  }

  // Group by file
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = f.file || '<stdin>';
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(f);
  }

  out += colorize(`⚠️  The goblin found ${findings.length} suspicious token${findings.length > 1 ? 's' : ''}!`, 'yellow', noColor) + '\n\n';

  for (const [file, fileFindings] of byFile) {
    out += colorize(`  ${file}`, 'bold', noColor) + '\n';
    for (const f of fileFindings) {
      const sevColor = f.severity === 'critical' ? 'red' : f.severity === 'high' ? 'yellow' : f.severity === 'medium' ? 'cyan' : 'gray';
      const sev = colorize(`[${f.severity.toUpperCase()}]`, sevColor, noColor);
      const conf = colorize(`(confidence: ${f.confidence})`, 'gray', noColor);
      const loc = colorize(`L${f.line}:${f.column}`, 'gray', noColor);
      const type = colorize(f.ruleName, 'magenta', noColor);
      out += `    ${sev} ${type} ${conf} ${loc}\n`;
      out += `      ${colorize('→', 'gray', noColor)} ${truncateForDisplay(f.snippetMasked)}\n`;
    }
    out += '\n';
  }

  if (skippedFiles && skippedFiles.length > 0) {
    out += colorize(`  Skipped ${skippedFiles.length} files (binary, too large, or excluded). Use --verbose for details.\n`, 'gray', noColor);
  }

  if (errors && errors.length > 0) {
    out += colorize(`  Encountered ${errors.length} errors reading files.\n`, 'red', noColor);
  }

  out += '\n' + colorize('  Tip: Run `leakgoblin sanitize --stdin` to get a redacted version safe for sharing.', 'gray', noColor) + '\n';
  out += colorize('  Remember: redaction is best-effort. Always review before pasting to external services.', 'gray', noColor) + '\n';

  return out;
}

export function formatSummary(result: ScanResult, options: FormatOptions = {}): string {
  const noColor = options.noColor;
  if (result.findings.length === 0) {
    return colorize('No secrets detected.', 'green', noColor);
  }
  return colorize(`Found ${result.findings.length} potential secrets.`, 'yellow', noColor);
}
