/* =========================================================================
   Personal Wealth Strategy: interactive layer
   - Reading progress bar, back-to-top, smooth scroll
   - AOS init (animate on scroll)
   - Chat-bubble reveal observer (staggered)
   - Zoom-callout activation on entry
   - Chart.js initialisation for all data charts
   - Phase 2 / projection toggles
   - Print summary card
   ========================================================================= */

(function () {
  'use strict';

  /* ---------- Theme-aware palette (reads live CSS variables) ----------
     Returns the current values of the design tokens so that charts and
     other JS-driven visuals respond to light/dark theme switches. */
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    return {
      primary: v('--color-primary'),
      primarySoft: v('--color-primary-soft'),
      secondary: v('--color-secondary'),
      secondarySoft: v('--color-secondary-soft'),
      green: v('--color-accent-green'),
      gold: v('--color-accent-gold'),
      goldDeep: v('--color-accent-gold-deep'),
      text: v('--color-text'),
      textSoft: v('--color-text-soft'),
      textMuted: v('--color-text-muted'),
      line: v('--color-line'),
      bg: v('--color-bg'),
      bgElevated: v('--color-bg-elevated'),
      danger: v('--color-danger'),
      warning: v('--color-warning')
    };
  }
  let palette = readPalette();

  /* ---------- Theme toggle ---------- */
  const themeToggle = document.getElementById('themeToggle');
  const themeColorMeta = document.getElementById('themeColorMeta');
  const iconMoon = document.getElementById('iconMoon');
  const iconSun = document.getElementById('iconSun');
  const chartRegistry = [];

  function syncToggleIcons(theme) {
    // Drive icon visibility via inline style so it works even if the CSS
    // stylesheet is slow/cached/blocked. This is the source of truth.
    if (iconMoon) iconMoon.style.display = theme === 'dark' ? 'none' : 'block';
    if (iconSun) iconSun.style.display = theme === 'dark' ? 'block' : 'none';
  }

  function setTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#0F1620' : '#0A3D62');
    }
    if (persist) {
      try { localStorage.setItem('theme', theme); } catch (e) { /* ignore */ }
    }
    syncToggleIcons(theme);
    palette = readPalette();
    applyChartDefaults();
    chartRegistry.forEach((ch) => {
      try { ch.update('none'); } catch (e) { /* chart already destroyed */ }
    });
    if (typeof window.__rebuildThemedCharts === 'function') {
      window.__rebuildThemedCharts();
    }
    refreshTocDrawerTheme();
  }

  // Sync icons immediately with whatever the inline bootstrap script set.
  syncToggleIcons(document.documentElement.getAttribute('data-theme') || 'light');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      setTheme(current === 'dark' ? 'light' : 'dark', true);
    });
  }

  // Follow OS preference if the user has not chosen explicitly.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener && mq.addEventListener('change', (e) => {
      let stored = null;
      try { stored = localStorage.getItem('theme'); } catch (err) { /* ignore */ }
      if (!stored) setTheme(e.matches ? 'dark' : 'light', false);
    });
  }

  /* ---------- 1. Reading progress + back-to-top ---------- */
  const progressBar = document.getElementById('progressBar');
  const backTop = document.getElementById('backTop');

  function onScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
    if (progressBar) progressBar.style.width = pct + '%';

    if (backTop) {
      if (scrollTop > 600) backTop.classList.add('is-visible');
      else backTop.classList.remove('is-visible');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (backTop) {
    backTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- 2. AOS init (when library is ready) ---------- */
  function initAOS() {
    if (typeof window.AOS !== 'undefined') {
      window.AOS.init({
        once: true,
        duration: 700,
        easing: 'ease-out-cubic',
        offset: 40,
        delay: 0,
        disable: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
      });
    } else {
      setTimeout(initAOS, 80);
    }
  }
  initAOS();

  /* ---------- 3. Chat bubble staggered reveal ---------- */
  const chats = document.querySelectorAll('[data-chat]');
  const chatObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const bubbles = entry.target.querySelectorAll('.chat__bubble');
        bubbles.forEach((b, i) => {
          setTimeout(() => b.classList.add('is-visible'), 120 + i * 350);
        });
        chatObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  chats.forEach((c) => chatObserver.observe(c));

  /* ---------- 4. Zoom callouts ---------- */
  const zooms = document.querySelectorAll('[data-zoom]');
  const zoomObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-active');
      } else if (entry.boundingClientRect.top > 0) {
        // re-trigger if scrolling back up past the element
        entry.target.classList.remove('is-active');
      }
    });
  }, { threshold: 0.35 });
  zooms.forEach((z) => zoomObserver.observe(z));

  /* ---------- 5. Print button (top bar + card) ---------- */
  const printBtn = document.getElementById('printBtn');
  const summaryPrintBtn = document.getElementById('summaryPrintBtn');
  function doPrint(e) {
    if (e) e.preventDefault();
    window.print();
  }
  if (printBtn) printBtn.addEventListener('click', doPrint);
  if (summaryPrintBtn) summaryPrintBtn.addEventListener('click', doPrint);

  /* ---------- 6. TOC drawer (light: simply scroll to #s0..#s17) ---------- */
  function refreshTocDrawerTheme() {
    // CSS variables on root automatically propagate to inline `var(--...)` styles,
    // but we re-apply the secondary-tint manually on hover state below.
  }
  const tocToggle = document.getElementById('tocToggle');
  if (tocToggle) {
    tocToggle.addEventListener('click', () => {
      // Build a quick inline drawer if missing
      let drawer = document.getElementById('tocDrawer');
      if (!drawer) {
        drawer = document.createElement('div');
        drawer.id = 'tocDrawer';
        drawer.setAttribute('role', 'dialog');
        drawer.style.cssText = `
          position: fixed; top: 0; right: 0; bottom: 0;
          width: min(360px, 90vw);
          background: var(--color-bg-elevated);
          box-shadow: -16px 0 40px var(--shadow-color-3);
          z-index: 200; transform: translateX(100%);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          overflow-y: auto; padding: 5rem 1.5rem 2rem;
          font-family: 'Inter', sans-serif;
        `;
        drawer.innerHTML = `
          <button id="tocClose" aria-label="Close" style="position:absolute;top:1rem;right:1rem;background:transparent;border:1px solid var(--color-line);width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1.1rem;color:var(--color-primary);">×</button>
          <div style="font-family:'Cormorant Garamond',serif;color:var(--color-primary);font-size:1.5rem;font-weight:600;margin-bottom:0.4rem;">Contents</div>
          <div style="font-size:0.8rem;color:var(--color-text-muted);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:1.2rem;">17 sections</div>
          <nav id="tocNav" style="display:flex;flex-direction:column;gap:0.2rem;font-size:0.93rem;">
            ${[
              ['s0', '0. Foreword'],
              ['s1', '1. What "money working for you" means'],
              ['s2', '2. The math of early retirement'],
              ['s3', '3. Three things before investing'],
              ['s4', '4. UK tax-advantaged accounts'],
              ['s5', '5. The market cap myth'],
              ['s6', '6. What to actually buy'],
              ['s7', '7. UK brokers'],
              ['s8', '8. Bonds, T-bills, MMFs'],
              ['s9', '9. Nigerian stocks'],
              ['s9-5', '9.5 Nigerian money market funds'],
              ['s9-6', '9.6 Nigerian real estate funds'],
              ['s10', '10. REITs vs property'],
              ['s11', '11. Currency strategy'],
              ['s12', '12. Death, inheritance, family'],
              ['s13', '13. Tax for international people'],
              ['s14', '14. Your tailored plan'],
              ['s14b', '14B. Summary card'],
              ['s15', '15. Universal rules'],
              ['s16', '16. Questions you still need to answer'],
              ['s17', '17. The single most important thing'],
              ['sources', 'Sources & further reading']
            ].map(([id, label]) =>
              `<a href="#${id}" class="toc-link" style="display:block;padding:0.55rem 0.7rem;border-radius:8px;color:var(--color-text);border:0;text-decoration:none;border-left:3px solid transparent;">${label}</a>`
            ).join('')}
          </nav>
        `;
        document.body.appendChild(drawer);

        // overlay
        const overlay = document.createElement('div');
        overlay.id = 'tocOverlay';
        overlay.style.cssText = `
          position: fixed; inset: 0; background: var(--color-overlay);
          z-index: 199; opacity: 0; transition: opacity 0.3s;
          backdrop-filter: blur(2px);
        `;
        document.body.appendChild(overlay);

        // wire close
        const close = () => {
          drawer.style.transform = 'translateX(100%)';
          overlay.style.opacity = '0';
          setTimeout(() => { overlay.style.pointerEvents = 'none'; }, 300);
        };
        drawer.querySelector('#tocClose').addEventListener('click', close);
        overlay.addEventListener('click', close);
        drawer.querySelectorAll('.toc-link').forEach((a) => {
          a.addEventListener('click', close);
          a.addEventListener('mouseenter', () => {
            a.style.background = 'var(--color-secondary-tint-08)';
            a.style.borderLeftColor = 'var(--color-secondary)';
          });
          a.addEventListener('mouseleave', () => {
            a.style.background = 'transparent';
            a.style.borderLeftColor = 'transparent';
          });
        });
      }

      // open
      const overlay = document.getElementById('tocOverlay');
      requestAnimationFrame(() => {
        drawer.style.transform = 'translateX(0)';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
      });
    });
  }

  /* ---------- 7. Charts ---------- */
  // Wait for Chart.js to be ready (it has `defer`)
  function ready(fn) {
    if (typeof window.Chart !== 'undefined') fn();
    else setTimeout(() => ready(fn), 60);
  }

  ready(initCharts);

  function applyChartDefaults() {
    if (typeof window.Chart === 'undefined') return;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = palette.textSoft;
    Chart.defaults.borderColor = palette.line;
    Chart.defaults.plugins.legend.labels.boxWidth = 14;
    Chart.defaults.plugins.legend.labels.boxHeight = 14;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.legend.labels.color = palette.text;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = palette.primary;
    Chart.defaults.plugins.tooltip.titleColor = palette.bg;
    Chart.defaults.plugins.tooltip.bodyColor = palette.bg;
    Chart.defaults.plugins.tooltip.titleFont = { weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont = { weight: '400' };
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.scale.grid.color = palette.line;
    Chart.defaults.scale.ticks = Chart.defaults.scale.ticks || {};
    Chart.defaults.scale.ticks.color = palette.textSoft;
  }

  function initCharts() {
    applyChartDefaults();

    // ---- Chart 1: Portfolio targets bar ----
    const ctxTargets = document.getElementById('chartTargets');
    if (ctxTargets) {
      chartRegistry.push(new Chart(ctxTargets, {
        type: 'bar',
        data: {
          labels: ['Retire at 50 (19yrs)', 'Retire at 55 (24yrs)', 'Retire at 60 (29yrs)'],
          datasets: [{
            label: 'Portfolio needed (£m)',
            data: [1.2, 1.35, 1.53],
            backgroundColor: (c) => [palette.primary, palette.secondary, palette.green][c.dataIndex],
            borderRadius: 8,
            maxBarThickness: 80
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => `£${c.parsed.y.toFixed(2)} million` } }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => '£' + v + 'm' }
            }
          }
        }
      }));
    }

    // ---- Chart 2: Monthly savings required ----
    const ctxMonthly = document.getElementById('chartMonthly');
    if (ctxMonthly) {
      chartRegistry.push(new Chart(ctxMonthly, {
        type: 'bar',
        data: {
          labels: ['Retire at 50', 'Retire at 55', 'Retire at 60'],
          datasets: [{
            label: 'Required monthly investment (£)',
            data: [2500, 1650, 1150],
            backgroundColor: (c) => [palette.danger, palette.warning, palette.green][c.dataIndex],
            borderRadius: 8,
            maxBarThickness: 80
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => `£${c.parsed.x.toLocaleString()}/month` } }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { callback: (v) => '£' + v.toLocaleString() }
            }
          }
        }
      }));
    }

    // ---- Chart 3: Asset allocation stacked ----
    const ctxAlloc = document.getElementById('chartAllocation');
    if (ctxAlloc) {
      chartRegistry.push(new Chart(ctxAlloc, {
        type: 'bar',
        data: {
          labels: ['Very aggressive', 'Aggressive (default)', 'Balanced', 'Conservative'],
          datasets: [
            { label: 'Equity', data: [90, 80, 70, 60], backgroundColor: () => palette.primary, borderRadius: 4 },
            { label: 'Bonds', data: [5, 15, 25, 35], backgroundColor: () => palette.secondary, borderRadius: 4 },
            { label: 'Cash / MMF', data: [5, 5, 5, 5], backgroundColor: () => palette.gold, borderRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y}%` } }
          },
          scales: {
            x: { stacked: true },
            y: {
              stacked: true,
              max: 100,
              ticks: { callback: (v) => v + '%' }
            }
          }
        }
      }));
    }

    // ---- Chart 4: Top NG MMF performers ----
    const ctxMMF = document.getElementById('chartTopMMF');
    if (ctxMMF) {
      chartRegistry.push(new Chart(ctxMMF, {
        type: 'bar',
        data: {
          labels: ['STL', 'Trustbanc', 'Page', 'Greenwich Plus', 'Emerging Africa',
                   'Chapel Hill Denham', 'Zedcrest', 'DLM', 'Norrenberger', 'SCM Capital'],
          datasets: [{
            label: 'YTD yield (%) · Q1 2026',
            data: [20.24, 19.55, 19.31, 18.34, 18.21, 18.13, 18.06, 17.99, 17.90, 17.72],
            backgroundColor: (c) => {
              const tiers = [
                palette.green, palette.secondary, palette.secondary,
                palette.primary, palette.primary, palette.primary,
                palette.primarySoft, palette.primarySoft, palette.primarySoft, palette.primarySoft
              ];
              return tiers[c.dataIndex];
            },
            borderRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => c.parsed.x.toFixed(2) + '% YTD (gross)' } }
          },
          scales: {
            x: { beginAtZero: true, ticks: { callback: (v) => v + '%' } }
          }
        }
      }));
    }

    // ---- Chart 5: GBP-effective return scenarios ----
    const ctxGbp = document.getElementById('chartGbpEffective');
    if (ctxGbp) {
      chartRegistry.push(new Chart(ctxGbp, {
        type: 'bar',
        data: {
          labels: ['Naira -25% (bad)', 'Naira -15% (typical)', 'Naira flat (rare)', 'Naira +5% (great)'],
          datasets: [{
            label: 'Effective GBP return (%)',
            data: [-7, 3, 18, 24],
            backgroundColor: (c) => c.parsed && c.parsed.y < 0 ? palette.danger
              : (c.parsed && c.parsed.y < 5 ? palette.warning
              : (c.parsed && c.parsed.y < 20 ? palette.secondary : palette.green)),
            borderRadius: 8,
            maxBarThickness: 70
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => 'Effective return: ' + (c.parsed.y > 0 ? '+' : '') + c.parsed.y + '%' } }
          },
          scales: {
            y: {
              ticks: { callback: (v) => (v > 0 ? '+' : '') + v + '%' },
              grid: { color: (ctx) => ctx.tick.value === 0 ? palette.primary : palette.line }
            }
          }
        }
      }));
    }

    // ---- Chart 6: Phase 2 allocations (toggle A/B) ----
    const ctxPhase2 = document.getElementById('chartPhase2');
    let phase2Chart;
    const phase2Data = {
      A: {
        labels: ['S&S ISA (VWRP)', 'Cash ISA buffer', 'Optional Nigeria slice'],
        data: [600, 150, 50],
        colors: () => [palette.primary, palette.secondary, palette.gold]
      },
      B: {
        labels: ['LISA (VWRP, +25% bonus)', 'S&S ISA (VWRP)', 'Cash ISA buffer'],
        data: [333, 367, 100],
        colors: () => [palette.green, palette.primary, palette.secondary]
      }
    };
    function renderPhase2(key) {
      const cfg = phase2Data[key];
      if (phase2Chart) {
        const idx = chartRegistry.indexOf(phase2Chart);
        if (idx > -1) chartRegistry.splice(idx, 1);
        phase2Chart.destroy();
      }
      phase2Chart = new Chart(ctxPhase2, {
        type: 'doughnut',
        data: {
          labels: cfg.labels,
          datasets: [{
            data: cfg.data,
            backgroundColor: cfg.colors(),
            borderColor: palette.bgElevated || '#fff',
            borderWidth: 3,
            hoverOffset: 12
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: (c) => c.label + ': £' + c.parsed + '/mo' } }
          }
        }
      });
      chartRegistry.push(phase2Chart);
    }
    if (ctxPhase2) {
      renderPhase2('A');
      document.querySelectorAll('[data-phase2]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-phase2]').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          renderPhase2(btn.dataset.phase2);
        });
      });
    }

    // ---- Chart 7: Compound projection (Conservative vs Aggressive) ----
    const ctxProj = document.getElementById('chartProjection');
    let projChart;
    let projMode = 'both';
    const projYears = [1, 2, 3, 5, 10, 15, 20, 25, 30];
    const projData = {
      conservative: [2.5, 13, 23.5, 60, 155, 290, 480, 780, 1200],   // £k
      aggressive:   [3,  15, 30,   90, 240, 540, 1050, 1820, 2700]
    };
    function hexToRgba(hex, alpha) {
      const h = (hex || '').replace('#', '').trim();
      if (h.length !== 6) return hex;
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    function renderProj(mode) {
      projMode = mode;
      const datasets = [];
      if (mode === 'both' || mode === 'cons') {
        datasets.push({
          label: 'Conservative (plan as written)',
          data: projData.conservative,
          borderColor: palette.secondary,
          backgroundColor: hexToRgba(palette.secondary, 0.15),
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 7,
          borderWidth: 3
        });
      }
      if (mode === 'both' || mode === 'agg') {
        datasets.push({
          label: 'Aggressive (income scales to £2.5k/mo)',
          data: projData.aggressive,
          borderColor: palette.primary,
          backgroundColor: hexToRgba(palette.primary, 0.12),
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 7,
          borderWidth: 3
        });
      }
      if (projChart) {
        const idx = chartRegistry.indexOf(projChart);
        if (idx > -1) chartRegistry.splice(idx, 1);
        projChart.destroy();
      }
      projChart = new Chart(ctxProj, {
        type: 'line',
        data: { labels: projYears.map((y) => 'Yr ' + y), datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: { label: (c) => c.dataset.label + ': £' + c.parsed.y.toLocaleString() + 'k' }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => '£' + v + 'k' }
            }
          }
        }
      });
      chartRegistry.push(projChart);
    }
    if (ctxProj) {
      renderProj('both');
      document.querySelectorAll('[data-proj]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-proj]').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          renderProj(btn.dataset.proj);
        });
      });
    }

    // Expose re-render hooks so theme switches that need fresh dataset
    // colours (line/area fills) can rebuild charts 6 and 7 with current palette.
    window.__rebuildThemedCharts = function () {
      if (ctxPhase2) {
        const activeBtn = document.querySelector('[data-phase2].is-active');
        renderPhase2(activeBtn ? activeBtn.dataset.phase2 : 'A');
      }
      if (ctxProj) renderProj(projMode);
    };
  }

  /* ---------- 8. Subtle parallax on hero (perf-cheap) ---------- */
  const hero = document.querySelector('.hero');
  if (hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        hero.style.backgroundPosition = `center ${y * 0.15}px`;
      }
    }, { passive: true });
  }

})();
