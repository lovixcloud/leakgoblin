import type { ScanResult, Finding } from '../engine/types.js';

export interface JsonReport {
  version: string;
  timestamp: string;
  scannedFiles?: number;
  findings: Omit<Finding, '_rawMatch' | '_secretValue'>[];
  skippedFiles?: { file: string; reason: string }[];
  errors?: { file: string; error: string }[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

export function formatJson(result: ScanResult): string {
  // Strip internal fields that contain secrets
  const safeFindings = result.findings.map(f => {
    const { _rawMatch, _secretValue, ...safe } = f;
    return safe;
  });

  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  
  for (const f of safeFindings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  }

  const report: JsonReport = {
    version: '0.1.3',
    timestamp: new Date().toISOString(),
    scannedFiles: result.scannedFiles,
    findings: safeFindings,
    skippedFiles: result.skippedFiles,
    errors: result.errors,
    summary: {
      total: safeFindings.length,
      bySeverity,
      byCategory,
    },
  };

  return JSON.stringify(report, null, 2);
}
