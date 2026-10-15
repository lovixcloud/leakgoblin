/* LeakGoblin Documentation - Interactive Browser Playground */
/* Client-side engine executing LeakGoblin detection rules in JS */

const PLAYGROUND_RULES = [
  {
    id: 'private_key_block',
    name: 'Private Key Block',
    category: 'private_key',
    description: 'PEM private key block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical',
    confidence: 'high',
    redactGroupOnly: false,
  },
  {
    id: 'aws_access_key',
    name: 'AWS Access Key',
    category: 'cloud_credential',
    description: 'AWS Access Key ID format AKIA...',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    secretGroupIndex: 1,
    severity: 'high',
    confidence: 'high',
    redactGroupOnly: true,
  },
  {
    id: 'aws_secret_key_assignment',
    name: 'AWS Secret Assignment',
    category: 'cloud_credential',
    description: 'aws_secret_access_key assignment',
    pattern: /(?:aws_secret_access_key|aws_secret|AWSSecretKey)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    secretGroupIndex: 1,
    severity: 'critical',
    confidence: 'high',
    redactGroupOnly: true,
  },
  {
    id: 'github_token',
    name: 'GitHub Token',
    category: 'api_key',
    description: 'GitHub PAT ghp_, gho_, ghu_, ghs_, ghr_, github_pat_',
    pattern: /\b((?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g,
    secretGroupIndex: 1,
    severity: 'critical',
    confidence: 'high',
    redactGroupOnly: true,
  },
  {
    id: 'stripe_key',
    name: 'Stripe API Key',
    category: 'api_key',
    description: 'Stripe sk_live_, sk_test_, rk_ keys',
    pattern: /\b((?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,})\b/g,
    secretGroupIndex: 1,
    severity: 'high',
    confidence: 'high',
    redactGroupOnly: true,
  },
  {
    id: 'slack_token',
    name: 'Slack Token',
    category: 'api_key',
    description: 'Slack xox tokens',
    pattern: /\b(xox[abpras]-[A-Za-z0-9-]{10,})\b/g,
    secretGroupIndex: 1,
    severity: 'high',
    confidence: 'high',
    redactGroupOnly: true,
  },
  {
    id: 'google_api_key',
    name: 'Google API Key',
    category: 'api_key',
    description: 'Google API key AIza...',
    pattern: /\b(AIza[0-9A-Za-z_-]{35})\b/g,
    secretGroupIndex: 1,
    severity: 'high',
    confidence: 'high',
    redactGroupOnly: true,
  },
  {
    id: 'openai_key',
    name: 'OpenAI API Key',
    category: 'api_key',
    description: 'OpenAI sk-proj or sk-...',
    pattern: /\b(sk-(?:proj-)?[A-Za-z0-9_-]{20,})\b/g,
    secretGroupIndex: 1,
    severity: 'high',
    confidence: 'medium',
    redactGroupOnly: true,
  },
  {
    id: 'bearer_token',
    name: 'Bearer Token',
    category: 'bearer_token',
    description: 'Authorization: Bearer <token>',
    pattern: /Bearer\s+([A-Za-z0-9\-_.~+\/]+=*)\b/gi,
    secretGroupIndex: 1,
    severity: 'high',
    confidence: 'medium',
    redactGroupOnly: true,
  },
  {
    id: 'jwt_token',
    name: 'JWT Token',
    category: 'jwt',
    description: 'JSON Web Token eyJ...',
    pattern: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    secretGroupIndex: 1,
    severity: 'medium',
    confidence: 'medium',
    redactGroupOnly: true,
  },
  {
    id: 'password_assignment',
    name: 'Password Assignment',
    category: 'password',
    description: 'password assignment with value',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^\s'";]{8,})['"]?/gi,
    secretGroupIndex: 1,
    severity: 'high',
    confidence: 'medium',
    redactGroupOnly: true,
  },
  {
    id: 'db_connection_string',
    name: 'Database Connection String',
    category: 'connection_string',
    description: 'mongodb, postgres, mysql, redis with credentials',
    pattern: /\b((?:mongodb|postgres|postgresql|mysql|redis):\/\/[^\s'";]+)/gi,
    secretGroupIndex: 1,
    severity: 'critical',
    confidence: 'high',
    redactGroupOnly: true,
  },
];

const SAMPLE_PROMPTS = {
  aws: `Help me debug my AWS Lambda script:
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
region = us-east-1`,

  github: `Here is my deployment script snippet:
export GITHUB_TOKEN="ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD"
git push origin main --tags`,

  database: `My app is failing to connect to backend DB:
DATABASE_URL="postgres://admin:s3cr3tP@ssw0rd@db.internal.example.com:5432/production"
Please optimize this query for postgres.`,

  mixed: `Can you review this code for performance and security?
const OPENAI_KEY = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz1234567890";
const STRIPE_KEY = "sk_live_51NxEXAMPLE1234567890abcdef";
const JWT_AUTH = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
`
};

function maskSecret(val) {
  if (!val) return '[REDACTED]';
  if (val.length <= 8) return val.substring(0, 2) + '...' + '[REDACTED]';
  return val.substring(0, 4) + '...' + val.substring(val.length - 2);
}

function scanText(text) {
  const findings = [];
  const lines = text.split('\n');

  lines.forEach((lineText, lineIdx) => {
    PLAYGROUND_RULES.forEach(rule => {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match;
      while ((match = regex.exec(lineText)) !== null) {
        const rawSecret = (rule.secretGroupIndex && match[rule.secretGroupIndex]) ? match[rule.secretGroupIndex] : match[0];
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          confidence: rule.confidence,
          line: lineIdx + 1,
          col: match.index + 1,
          masked: maskSecret(rawSecret),
        });
      }
    });
  });

  return findings;
}

function sanitizeText(text) {
  let result = text;
  PLAYGROUND_RULES.forEach(rule => {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    result = result.replace(regex, (match, ...groups) => {
      const redactionLabel = `[REDACTED:${rule.category.toUpperCase()}:${rule.id}]`;
      if (rule.redactGroupOnly && rule.secretGroupIndex && groups[rule.secretGroupIndex - 1]) {
        const secretVal = groups[rule.secretGroupIndex - 1];
        return match.replace(secretVal, redactionLabel);
      }
      return redactionLabel;
    });
  });
  return result;
}

function initPlayground() {
  const inputEl = document.getElementById('playground-input');
  const outputEl = document.getElementById('playground-output');
  const findingsEl = document.getElementById('playground-findings');
  const sampleSelect = document.getElementById('playground-sample-select');
  const sanitizeBtn = document.getElementById('playground-sanitize-btn');

  if (!inputEl || !outputEl) return;

  function processPlayground() {
    const text = inputEl.value;
    const findings = scanText(text);
    const sanitized = sanitizeText(text);

    outputEl.value = sanitized;

    if (findingsEl) {
      if (findings.length === 0) {
        findingsEl.innerHTML = '<div class="callout" style="border-left-color: var(--primary-color);"><strong>🛡️ Goblin Status: Clean!</strong> No secrets detected in input text.</div>';
      } else {
        let html = `<div class="callout callout-warning"><strong>⚠️ Goblin found ${findings.length} secret(s)!</strong></div><ul class="findings-list">`;
        findings.forEach(f => {
          html += `
            <li class="finding-item">
              <div class="finding-item-header">
                <span class="finding-name">${f.ruleName}</span>
                <span class="badge badge-${f.severity}">${f.severity}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                Line ${f.line}:${f.col} | Category: <code>${f.category}</code> | Confidence: ${f.confidence}
              </div>
              <div style="font-family: var(--font-mono); margin-top: 0.25rem; font-size: 0.8rem;">
                Masked Preview: <code>${f.masked}</code>
              </div>
            </li>
          `;
        });
        html += '</ul>';
        findingsEl.innerHTML = html;
      }
    }
  }

  inputEl.addEventListener('input', processPlayground);

  if (sampleSelect) {
    sampleSelect.addEventListener('change', (e) => {
      const key = e.target.value;
      if (SAMPLE_PROMPTS[key]) {
        inputEl.value = SAMPLE_PROMPTS[key];
        processPlayground();
      }
    });
  }

  if (sanitizeBtn) {
    sanitizeBtn.addEventListener('click', () => {
      processPlayground();
      outputEl.select();
      navigator.clipboard.writeText(outputEl.value).then(() => {
        const originalText = sanitizeBtn.textContent;
        sanitizeBtn.textContent = 'Copied!';
        setTimeout(() => sanitizeBtn.textContent = originalText, 1500);
      }).catch(() => {});
    });
  }

  // Initial pass
  processPlayground();
}

document.addEventListener('DOMContentLoaded', initPlayground);
