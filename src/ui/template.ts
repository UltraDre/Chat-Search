// Markup for the three tabs. Kept close to the original single-file build so the
// layout, labels and copy stay identical; behaviour lives in the sibling modules.
export const TEMPLATE = `<div class="app">
        <div class="tab-bar">
            <button class="tab-btn active" data-tab="search">Search</button>
            <button class="tab-btn" data-tab="results">Results</button>
            <button class="tab-btn" data-tab="names">Names</button>
        </div>

        <div class="tab-panels">
            <!-- TAB 1: SEARCH -->
            <div class="tab-panel active-panel" id="searchPanel">
                <div class="control-card">
                    <div class="flex-between">
                        <div>
                            <h1>⌕ log search</h1>
                            <div class="sub">upload · filter by speaker &amp; date</div>
                        </div>
                        <div class="head-actions">
                            <button id="installBtn" class="ghost-pill" type="button" hidden>install app</button>
                            <div class="stats-badge" id="parseStats">no file</div>
                        </div>
                    </div>

                    <div class="file-zone">
                        <input type="file" id="fileInput" accept=".txt,.text,text/plain" aria-label="choose a chat log" style="display: none;">
                        <button class="file-label" id="uploadBtn" type="button">choose .txt</button>
                        <span id="fileName">none</span>
                        <button id="clearFileBtn" class="secondary" type="button" style="padding: 4px 12px;">clear</button>
                        <span id="restoreIndicator" class="restore-badge" style="display:none;">↻ restored</span>
                    </div>

                    <div class="flex-row">
                        <div class="field-group">
                            <label>speaker 1 *</label>
                            <div class="input-wrap">
                                <input type="text" id="name1" placeholder="e.g. Samuel" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="search" aria-label="speaker 1">
                                <div class="suggestions-dropdown" id="suggestions1"></div>
                            </div>
                        </div>
                        <div class="field-group">
                            <label>speaker 2</label>
                            <div class="input-wrap">
                                <input type="text" id="name2" placeholder="optional" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="search" aria-label="speaker 2">
                                <div class="suggestions-dropdown" id="suggestions2"></div>
                            </div>
                        </div>
                        <div class="field-group">
                            <label>from</label>
                            <input type="date" id="startDate">
                        </div>
                        <div class="field-group">
                            <label>to</label>
                            <input type="date" id="endDate">
                        </div>
                        <div class="field-group">
                            <label>contains (search all)</label>
                            <input type="text" id="searchText" placeholder="any word or sentence" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="contains">
                        </div>
                        <div class="field-group">
                            <label>&nbsp;</label>
                            <button id="searchBtn" type="button">search</button>
                        </div>
                    </div>

                    <div class="format-example">
                        <span style="font-weight:500; color:inherit;">Formats</span>
                        &nbsp;·&nbsp; <code>[15/07/2025, 23:11:51] Speaker: text</code>
                        &nbsp;·&nbsp; <code>6/6/26, 22:16 - Speaker: text</code>
                        <br>
                        <span class="accent">↳</span> multi‑line merged &nbsp;·&nbsp; <span class="highlight">speaker 1 yellow</span>
                        &nbsp;·&nbsp; <span style="color:#00ff00;font-weight:600;">speaker 2 bright green</span>
                        &nbsp;·&nbsp; <span style="color:#2563eb;font-weight:600;">keyword blue</span>
                        &nbsp;·&nbsp; <span style="color:#64748b;">💾 auto‑saved · date pickers default to today</span>
                        &nbsp;·&nbsp; <span style="color:#64748b;">📲 installable · works offline</span>
                    </div>
                </div>
            </div>

            <!-- TAB 2: RESULTS — WHATSAPP STYLE (no avatar) -->
            <div class="tab-panel" id="resultsPanel">
                <div class="results-raw">
                    <div class="results-header">
                        <span class="result-count-badge" id="resultCountBadge">0 messages</span>
                        <button class="delete-selected-btn" id="deleteSelectedBtn" type="button">🗑 Delete selected</button>
                    </div>
                    <div id="resultsContainer" class="message-list">
                        <div class="empty-state">upload a log · search → results appear here<br><span style="color:#94a3b8;">select messages with checkboxes · delete selected</span></div>
                    </div>
                </div>
            </div>

            <!-- TAB 3: NAMES -->
            <div class="tab-panel" id="namesPanel">
                <div class="control-card">
                    <div class="flex-between">
                        <div>
                            <h1>👤 names</h1>
                            <div class="sub">saved speakers · tap ✕ to remove</div>
                        </div>
                        <div class="stats-badge" id="namesCount">0 names</div>
                    </div>
                    <div class="names-list" id="namesList"></div>
                </div>
            </div>
        </div>

        <footer id="mainFooter">dual format · continuation lines · speaker 1 <span style="color:#facc15;font-weight:600;">yellow</span> · speaker 2 <span style="color:#00ff00;font-weight:600;">bright green</span> · keyword <span style="color:#2563eb;font-weight:600;">blue</span> · select &amp; delete · auto‑persist</footer>
    </div>`;
