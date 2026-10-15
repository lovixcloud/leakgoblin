/* LeakGoblin Documentation - Application Logic */
/* Accessibility, Theme Persistence, Live Search, Mobile Nav & Config Builder */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileNav();
  initSearch();
  initCopyButtons();
  initConfigBuilder();
  initScrollspy();
});

/* Theme Management (Dark / Light Mode) */
function initTheme() {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');

  const savedTheme = localStorage.getItem('leakgoblin-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(currentTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('leakgoblin-theme', currentTheme);
      applyTheme(currentTheme);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    }
  }
}

/* Mobile Sidebar Drawer Navigation */
function initMobileNav() {
  const toggleBtn = document.getElementById('mobile-nav-toggle');
  const sidebar = document.getElementById('sidebar-nav');

  if (!toggleBtn || !sidebar) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Close sidebar on link click in mobile view
  sidebar.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 992) {
        sidebar.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

/* Client-Side Live Search */
function initSearch() {
  const searchInput = document.getElementById('search-input');
  const dropdown = document.getElementById('search-results-dropdown');

  if (!searchInput || !dropdown) return;

  // Build searchable index from headings
  const index = [];
  document.querySelectorAll('main h2, main h3').forEach(heading => {
    const id = heading.id || heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!heading.id) heading.id = id;

    let textSnippet = '';
    let next = heading.nextElementSibling;
    while (next && !['H2', 'H3'].includes(next.tagName) && textSnippet.length < 120) {
      textSnippet += ' ' + next.textContent;
      next = next.nextElementSibling;
    }

    index.push({
      id: heading.id,
      title: heading.textContent.replace(/^#\s*/, ''),
      snippet: textSnippet.trim(),
    });
  });

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) {
      dropdown.classList.remove('active');
      dropdown.innerHTML = '';
      return;
    }

    const matches = index.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.snippet.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      dropdown.innerHTML = '<div style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem;">No results found</div>';
    } else {
      dropdown.innerHTML = matches.slice(0, 6).map(m => `
        <a href="#${m.id}" class="search-result-item">
          <div class="search-result-title">${escapeHtml(m.title)}</div>
          <div class="search-result-snippet">${escapeHtml(m.snippet)}</div>
        </a>
      `).join('');
    }
    dropdown.classList.add('active');
  });

  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });

  dropdown.addEventListener('click', () => {
    dropdown.classList.remove('active');
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Copy Code Snippet Buttons */
function initCopyButtons() {
  document.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button');
    button.className = 'copy-btn';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code block');

    button.addEventListener('click', () => {
      const code = pre.querySelector('code')?.innerText || pre.innerText;
      navigator.clipboard.writeText(code).then(() => {
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = 'Copy', 2000);
      }).catch(err => {
        button.textContent = 'Failed';
      });
    });

    pre.style.position = 'relative';
    pre.appendChild(button);
  });
}

/* Interactive Config Builder */
function initConfigBuilder() {
  const form = document.getElementById('config-builder-form');
  const preview = document.getElementById('config-json-preview');
  const downloadBtn = document.getElementById('config-download-btn');

  if (!form || !preview) return;

  function updateConfigJSON() {
    const severityThreshold = document.getElementById('cfg-severity').value;
    const confidenceThreshold = document.getElementById('cfg-confidence').value;
    const maxFileSizeMB = parseInt(document.getElementById('cfg-max-size').value, 10) || 5;

    const exclude = [];
    if (document.getElementById('cfg-ex-git').checked) exclude.push('.git');
    if (document.getElementById('cfg-ex-node').checked) exclude.push('node_modules');
    if (document.getElementById('cfg-ex-dist').checked) exclude.push('dist');
    if (document.getElementById('cfg-ex-fixtures').checked) exclude.push('fixtures');

    const allowlistPatterns = document.getElementById('cfg-allowlist-patterns').value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const config = {
      version: 1,
      severityThreshold,
      confidenceThreshold,
      maxFileSizeMB,
      exclude,
      customPatterns: [
        {
          id: "internal_api_token",
          pattern: "INTERNAL_[A-Z0-9_]{16,}",
          description: "Internal team service token",
          category: "api_key",
          severity: "high",
          confidence: "medium"
        }
      ],
      allowlist: {
        files: [],
        patterns: allowlistPatterns
      }
    };

    preview.textContent = JSON.stringify(config, null, 2);
  }

  form.addEventListener('input', updateConfigJSON);
  form.addEventListener('change', updateConfigJSON);

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([preview.textContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leakgoblin.config.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  updateConfigJSON();
}

/* Active Navigation Scrollspy */
function initScrollspy() {
  const sections = document.querySelectorAll('main section[id], main h2[id]');
  const navLinks = document.querySelectorAll('.nav-link, .toc-link');

  if (!sections.length) return;

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPos = window.scrollY + 100;

    sections.forEach(sec => {
      if (sec.offsetTop <= scrollPos) {
        currentId = sec.getAttribute('id');
      }
    });

    if (currentId) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentId}`) {
          link.classList.add('active');
        }
      });
    }
  });
}
