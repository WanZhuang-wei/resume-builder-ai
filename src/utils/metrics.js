class MetricsCollector {
  constructor() {
    this._data = this._createFreshData();
    this._history = [];
    this._loadHistory();
  }

  _createFreshData() {
    return {
      api: { calls: 0, errors: 0, retries: 0, totalLatency: 0, firstTokenLatency: [] },
      parse: { calls: 0, errors: 0, totalDuration: 0, formats: {} },
      perf: { routeTransitions: [], pageLoadTimes: {} },
      generation: { counts: 0, userEdits: 0, matchScores: [] },
    };
  }

  // ---- API calls ----
  recordApiCall({ duration, firstToken, success, retries = 0 } = {}) {
    this._data.api.calls++;
    if (!success) this._data.api.errors++;
    this._data.api.retries += retries;
    this._data.api.totalLatency += duration || 0;
    if (firstToken !== undefined && firstToken !== null) {
      this._data.api.firstTokenLatency.push(firstToken);
    }
  }

  // ---- Parse ----
  recordParse({ format, duration, success = true } = {}) {
    this._data.parse.calls++;
    if (!success) this._data.parse.errors++;
    this._data.parse.totalDuration += duration || 0;
    if (format) {
      this._data.parse.formats[format] = (this._data.parse.formats[format] || 0) + 1;
    }
  }

  // ---- Generation ----
  recordGeneration({ matchScore, userEdited = false } = {}) {
    this._data.generation.counts++;
    if (userEdited) this._data.generation.userEdits++;
    if (matchScore !== undefined && matchScore !== null) {
      this._data.generation.matchScores.push(matchScore);
    }
  }

  // ---- Route ----
  recordRouteTransition({ from, to, duration } = {}) {
    this._data.perf.routeTransitions.push({
      from: from || "",
      to: to || "",
      duration: duration || 0,
      timestamp: Date.now(),
    });
  }

  // ---- Stats ----
  getStats() {
    const a = this._data.api;
    const p = this._data.parse;
    const g = this._data.generation;
    return {
      api: {
        totalCalls: a.calls, errors: a.errors, retries: a.retries,
        successRate: a.calls > 0 ? ((1 - a.errors / a.calls) * 100) : null,
        retryRate: a.calls > 0 ? (a.retries / a.calls * 100) : null,
        avgLatency: a.calls > 0 ? (a.totalLatency / a.calls) : null,
        avgFirstToken: a.firstTokenLatency.length > 0
          ? a.firstTokenLatency.reduce((x, y) => x + y, 0) / a.firstTokenLatency.length : null,
      },
      parse: {
        totalCalls: p.calls, errors: p.errors,
        successRate: p.calls > 0 ? ((1 - p.errors / p.calls) * 100) : null,
        avgDuration: p.calls > 0 ? (p.totalDuration / p.calls) : null,
        formatDistribution: { ...p.formats },
      },
      generation: {
        totalGenerated: g.counts, userEdits: g.userEdits,
        avgMatchScore: g.matchScores.length > 0
          ? g.matchScores.reduce((x, y) => x + y, 0) / g.matchScores.length : null,
        userEditRate: g.counts > 0 ? (g.userEdits / g.counts * 100) : null,
      },
      perf: { routeTransitionCount: this._data.perf.routeTransitions.length },
    };
  }

  generateReport() {
    return { timestamp: new Date().toISOString(), metrics: this.getStats() };
  }

  // ---- History (daily snapshots) ----
  saveSnapshot() {
    this._history.push({
      date: new Date().toISOString().slice(0, 10),
      ...this.getStats(),
    });
    if (this._history.length > 30) this._history = this._history.slice(-30);
    this._saveHistory();
  }

  getHistory() {
    return [...this._history];
  }

  _loadHistory() {
    try {
      const saved = globalThis.localStorage?.getItem("resume_metrics_history");
      if (saved) this._history = JSON.parse(saved);
    } catch {}
  }

  _saveHistory() {
    try {
      globalThis.localStorage?.setItem("resume_metrics_history", JSON.stringify(this._history));
    } catch {}
  }

  // ---- Persistence ----
  persist() {
    this.saveSnapshot();
    const key = this._storageKey(new Date());
    localStorage.setItem(key, JSON.stringify(this._data));
    this._cleanupOldKeys();
  }

  loadPersisted(date) {
    const key = this._storageKey(date || new Date());
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this._data = this._mergeData(parsed);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  clear() {
    this._data = this._createFreshData();
  }

  clearHistory() {
    this._history = [];
    this._saveHistory();
  }

  _storageKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return "resume_metrics_" + y + "-" + m + "-" + day;
  }

  _cleanupOldKeys() {
    const now = Date.now();
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("resume_metrics_")) {
        const ds = key.slice("resume_metrics_".length);
        const d = new Date(ds).getTime();
        if ((now - d) / (1000 * 60 * 60 * 24) > 7) localStorage.removeItem(key);
      }
    }
  }

  _mergeData(parsed) {
    const f = this._createFreshData();
    return {
      api: Object.assign({}, f.api, parsed.api, {
        firstTokenLatency: (parsed.api && parsed.api.firstTokenLatency) || [],
      }),
      parse: Object.assign({}, f.parse, parsed.parse, {
        formats: (parsed.parse && parsed.parse.formats) || {},
      }),
      perf: Object.assign({}, f.perf, parsed.perf, {
        routeTransitions: (parsed.perf && parsed.perf.routeTransitions) || [],
      }),
      generation: Object.assign({}, f.generation, parsed.generation, {
        matchScores: (parsed.generation && parsed.generation.matchScores) || [],
      }),
    };
  }
}

export const metrics = new MetricsCollector();


