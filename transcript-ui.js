/*
Name of Code Artifact: transcript-ui.js
Description: Injects the transcript toggle, draggable transcript drawer, and AssemblyAI streaming flow.
Programmer's Name: Jenny Tsotezo, Sam Kelemen
Date Created: 03/15/2026
Date Revised: 03/29/2026
Preconditions (inputs): Supported page media, YouTube captions, or AssemblyAI streaming
Postcondition (outputs): Clickable transcript UI that opens vocab popups
Errors: n/a
*/

(() => {
    // Default AssemblyAI API endpoint saved in extension settings
    const VV_DEFAULT_STT_ENDPOINT = 'https://api.assemblyai.com';
    // Default AssemblyAI streaming model used for real-time transcription
    const VV_DEFAULT_STT_MODEL = 'universal-streaming-multilingual';
    // Sample rate required by the streaming websocket connection
    const VV_STREAM_SAMPLE_RATE = 16000;
    // Message source tag used when exchanging data with injected YouTube page scripts
    const VV_TRANSCRIPT_SOURCE = 'vocabvault-transcript';
    // Regex used to split transcript text into individual clickable words
    const VV_WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

    // Initializes the transcript UI module after content.js passes in shared helpers
    function init(deps) {
        // Prevent the transcript UI from being initialized more than once on a page
        if (window.__vvTranscriptInitialized) {
            return;
        }
        window.__vvTranscriptInitialized = true;

        // Shared helpers come from content.js so transcript clicks can reuse the existing vocab popup flow
        const { showTranslation, showNotification, escapeHtml } = deps;
        // Central in-memory state for the transcript UI, media tracking, websocket, and drag behavior
        const transcriptState = {
            mediaElement: null,
            mediaListeners: [],
            button: null,
            drawer: null,
            statusEl: null,
            summaryEl: null,
            bodyEl: null,
            hintEl: null,
            words: [],
            segments: [],
            wordId: 0,
            activeSegmentIndex: -1,
            captureStream: null,
            audioContext: null,
            audioSourceNode: null,
            audioProcessorNode: null,
            audioSinkNode: null,
            websocket: null,
            websocketUrl: '',
            websocketIntentionalClose: false,
            streamTurns: [],
            streamBaseTime: 0,
            usingLiveTranscription: false,
            currentUrl: location.href,
            pagePoller: null,
            dragPointerId: null,
            dragOffsetX: 0,
            dragOffsetY: 0,
            drawerPosition: null
        };

        // Boot the transcript UI as soon as the helper dependencies are available
        bootstrapTranscriptUi();

        // Sets up styles, media detection, and page listeners for transcript controls
        function bootstrapTranscriptUi() {
            // Ensure shared transcript styles exist once per page
            ensureTranscriptStyles();
            // Detect the best active media element immediately
            refreshTranscriptTarget();

            // Poll for SPA navigation changes and for media element changes on dynamic pages like YouTube
            transcriptState.pagePoller = window.setInterval(() => {
                // If the page URL changes, reset transcript state for the new media context
                if (location.href !== transcriptState.currentUrl) {
                    transcriptState.currentUrl = location.href;
                    resetTranscriptSession();
                }

                // Re-evaluate which media element should own the transcript controls
                refreshTranscriptTarget();
                // Keep the floating transcript button positioned near the media player
                positionTranscriptButton();
            }, 1500);

            // Reposition the floating transcript button during layout changes
            window.addEventListener('resize', positionTranscriptButton);
            window.addEventListener('scroll', positionTranscriptButton, true);
        }

        // Injects all styles used by the transcript drawer and toggle button
        function ensureTranscriptStyles() {
            // Avoid duplicate style elements when the script is re-evaluated
            if (document.getElementById('vv-transcript-styles')) {
                return;
            }

            const style = document.createElement('style');
            style.id = 'vv-transcript-styles';
            style.textContent = `
                #vv-popup {
                    position: fixed;
                    inset: 0;
                    z-index: 2147483647;
                    font-family: "Trebuchet MS", "Avenir Next", Arial, sans-serif;
                }
                .vv-modal-backdrop {
                    position: absolute;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.35);
                    backdrop-filter: blur(3px);
                }
                .vv-modal-card {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    min-width: 350px;
                    max-width: min(520px, calc(100vw - 32px));
                    background: linear-gradient(180deg, #fffdf5 0%, #ffffff 100%);
                    color: #1f2937;
                    border-radius: 18px;
                    box-shadow: 0 20px 65px rgba(15, 23, 42, 0.34);
                    padding: 24px;
                    border: 1px solid rgba(12, 74, 110, 0.12);
                }
                .vv-modal-close {
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    width: 34px;
                    height: 34px;
                    border: none;
                    border-radius: 999px;
                    background: #ef4444;
                    color: white;
                    cursor: pointer;
                    font-size: 22px;
                    line-height: 1;
                }
                .vv-modal-group {
                    margin-bottom: 16px;
                }
                .vv-label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 12px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #475569;
                }
                .vv-original,
                .vv-translation {
                    padding: 13px 14px;
                    border-radius: 12px;
                    line-height: 1.55;
                    font-size: 16px;
                }
                .vv-original {
                    background: #f8fafc;
                }
                .vv-translation {
                    background: #dbeafe;
                    font-weight: 600;
                }
                .vv-select {
                    width: 100%;
                    padding: 11px 12px;
                    border-radius: 12px;
                    border: 1px solid #cbd5e1;
                    font-size: 14px;
                }
                .vv-primary-btn {
                    width: 100%;
                    border: none;
                    border-radius: 14px;
                    font-size: 14px;
                    font-weight: 700;
                    color: white;
                    cursor: pointer;
                    background: linear-gradient(135deg, #0f766e 0%, #1d4ed8 100%);
                }
                .vv-note {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 2147483647;
                    background: #15803d;
                    color: white;
                    padding: 14px 24px;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.24);
                    font-family: "Trebuchet MS", Arial, sans-serif;
                    font-size: 14px;
                    font-weight: 600;
                }
                #vv-transcript-toggle {
                    position: fixed;
                    z-index: 2147483645;
                    border: none;
                    border-radius: 999px;
                    padding: 12px 18px;
                    background: linear-gradient(135deg, #14532d 0%, #0369a1 100%);
                    color: white;
                    font: 700 14px/1 "Trebuchet MS", Arial, sans-serif;
                    box-shadow: 0 10px 28px rgba(3, 105, 161, 0.35);
                    cursor: pointer;
                }
                #vv-transcript-drawer {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    width: min(420px, calc(100vw - 32px));
                    max-height: calc(100vh - 48px);
                    z-index: 2147483644;
                    border-radius: 24px;
                    background: linear-gradient(180deg, rgba(247, 254, 231, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);
                    box-shadow: 0 24px 90px rgba(15, 23, 42, 0.26);
                    border: 1px solid rgba(21, 128, 61, 0.18);
                    display: none;
                    overflow: hidden;
                    color: #1f2937;
                    font-family: "Trebuchet MS", "Avenir Next", Arial, sans-serif;
                }
                #vv-transcript-drawer.vv-open {
                    display: flex;
                    flex-direction: column;
                }
                .vv-transcript-header {
                    padding: 18px 18px 14px;
                    background: radial-gradient(circle at top left, rgba(22, 163, 74, 0.16), transparent 50%), #f8fafc;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
                    cursor: grab;
                    user-select: none;
                    touch-action: none;
                }
                .vv-transcript-header:active {
                    cursor: grabbing;
                }
                .vv-transcript-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }
                .vv-transcript-title {
                    margin: 0;
                    font-size: 22px;
                    color: #14532d;
                }
                .vv-transcript-close {
                    border: none;
                    background: #e2e8f0;
                    border-radius: 999px;
                    width: 34px;
                    height: 34px;
                    cursor: pointer;
                    font-size: 20px;
                    line-height: 1;
                    color: #0f172a;
                }
                .vv-transcript-status {
                    margin: 10px 0 6px;
                    font-size: 13px;
                    font-weight: 700;
                    color: #0369a1;
                }
                .vv-transcript-summary {
                    margin: 0;
                    font-size: 13px;
                    color: #475569;
                    line-height: 1.45;
                }
                .vv-transcript-body {
                    overflow-y: auto;
                    padding: 16px 18px 18px;
                }
                .vv-transcript-hint {
                    margin: 0 0 16px;
                    padding: 12px 14px;
                    border-radius: 14px;
                    background: #eff6ff;
                    color: #1d4ed8;
                    font-size: 13px;
                    line-height: 1.5;
                }
                .vv-transcript-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 12px;
                }
                .vv-secondary-btn {
                    border: none;
                    border-radius: 12px;
                    padding: 10px 14px;
                    background: #0f766e;
                    color: white;
                    cursor: pointer;
                    font-weight: 700;
                }
                .vv-link-btn {
                    display: inline-block;
                    border-radius: 12px;
                    padding: 10px 14px;
                    background: #dbeafe;
                    color: #1d4ed8;
                    text-decoration: none;
                    font-weight: 700;
                }
                .vv-segment {
                    margin-bottom: 12px;
                    border-radius: 16px;
                    padding: 12px 12px 10px;
                    background: rgba(255, 255, 255, 0.84);
                    border: 1px solid transparent;
                    transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
                }
                .vv-segment.vv-active {
                    border-color: rgba(2, 132, 199, 0.4);
                    background: #ecfeff;
                    transform: translateX(-4px);
                }
                .vv-segment-time {
                    margin-bottom: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #0f766e;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .vv-word {
                    display: inline-flex;
                    align-items: center;
                    margin: 0 8px 8px 0;
                    padding: 6px 10px;
                    border: none;
                    border-radius: 999px;
                    background: #f1f5f9;
                    color: #0f172a;
                    cursor: pointer;
                    font-size: 14px;
                    line-height: 1.1;
                    transition: transform 0.14s ease, background 0.14s ease, color 0.14s ease;
                }
                .vv-word:hover {
                    background: #1d4ed8;
                    color: white;
                    transform: translateY(-1px);
                }
                .vv-empty {
                    padding: 24px 6px 8px;
                    text-align: center;
                    color: #64748b;
                    line-height: 1.6;
                }
                @media (max-width: 720px) {
                    #vv-transcript-drawer {
                        top: auto;
                        right: 12px;
                        left: 12px;
                        bottom: 12px;
                        width: auto;
                        max-height: 72vh;
                    }
                }
            `;

            document.documentElement.appendChild(style);
        }

        // Detects whether the page's primary audio/video element has changed
        function refreshTranscriptTarget() {
            // Pick the most likely active media element on the page
            const media = findPrimaryMediaElement();
            // If the chosen media element did not change, no reset is needed
            if (media === transcriptState.mediaElement) {
                return;
            }

            // Unbind old media listeners before switching to a different player
            detachMediaListeners();
            // Save the new media target
            transcriptState.mediaElement = media;
            // Clear transcript state whenever the target media changes
            resetTranscriptSession();

            // If no usable media exists, remove transcript UI and exit
            if (!media) {
                removeTranscriptButton();
                closeTranscriptDrawer();
                return;
            }

            // Rebind listeners and show the transcript toggle for the new media element
            attachMediaListeners(media);
            ensureTranscriptButton();
            positionTranscriptButton();
        }

        // Finds the most likely video or audio element the user cares about on the page
        function findPrimaryMediaElement() {
            // Gather all page media elements and rank visible candidates by size/activity
            const mediaNodes = Array.from(document.querySelectorAll('video, audio'));
            const candidates = mediaNodes
                .filter((node) => isVisibleMedia(node))
                .map((node) => ({ node, score: scoreMediaElement(node) }))
                .sort((left, right) => right.score - left.score);

            return candidates[0]?.node || null;
        }

        // Checks whether a media element is large and visible enough to be treated as primary
        function isVisibleMedia(node) {
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return rect.width > 140 && rect.height > 40 && style.visibility !== 'hidden' && style.display !== 'none';
        }

        // Scores media elements so the transcript button follows the most relevant one
        function scoreMediaElement(node) {
            const rect = node.getBoundingClientRect();
            // Larger media gets a higher base score
            let score = rect.width * rect.height;
            // Currently playing media is strongly preferred over paused media
            if (!node.paused) score += 1000000;
            // On YouTube, visible video elements should beat all other page media
            if (location.hostname.includes('youtube.com') && node.tagName === 'VIDEO') score += 2500000;
            return score;
        }

        // Adds listeners to keep transcript highlighting and live transcription in sync with media playback
        function attachMediaListeners(media) {
            // Update highlighted transcript segment, and resume streaming if playback starts while the drawer is open
            const syncHighlight = () => {
                updateTranscriptHighlight();
                if (!media.paused && transcriptState.usingLiveTranscription && isDrawerOpen()) {
                    ensureLiveStreaming();
                }
            };

            // Pauses only affect highlighting; the websocket remains managed by the drawer/session lifecycle
            const pauseListener = () => {
                updateTranscriptHighlight();
            };

            // Bind standard playback lifecycle events
            media.addEventListener('timeupdate', syncHighlight);
            media.addEventListener('play', syncHighlight);
            media.addEventListener('pause', pauseListener);
            media.addEventListener('ended', pauseListener);

            transcriptState.mediaListeners = [
                ['timeupdate', syncHighlight],
                ['play', syncHighlight],
                ['pause', pauseListener],
                ['ended', pauseListener]
            ];
        }

        // Removes any media listeners attached to the previously active element
        function detachMediaListeners() {
            if (!transcriptState.mediaElement) return;
            transcriptState.mediaListeners.forEach(([eventName, listener]) => {
                transcriptState.mediaElement.removeEventListener(eventName, listener);
            });
            transcriptState.mediaListeners = [];
        }

        // Creates the floating button used to open and close the transcript drawer
        function ensureTranscriptButton() {
            if (transcriptState.button) return;
            const button = document.createElement('button');
            button.id = 'vv-transcript-toggle';
            button.type = 'button';
            button.textContent = 'Open Transcript';
            button.addEventListener('click', toggleTranscriptDrawer);
            document.body.appendChild(button);
            transcriptState.button = button;
        }

        // Removes the floating transcript button when no supported media is active
        function removeTranscriptButton() {
            if (!transcriptState.button) return;
            transcriptState.button.remove();
            transcriptState.button = null;
        }

        // Positions the floating button near the active media element, or in a fallback corner if off-screen
        function positionTranscriptButton() {
            if (!transcriptState.button || !transcriptState.mediaElement) return;
            // Keep the label synchronized with the drawer state
            updateTranscriptButtonLabel();

            const rect = transcriptState.mediaElement.getBoundingClientRect();
            const button = transcriptState.button;
            // Default placement is near the upper-right area of the media element
            button.style.top = `${Math.max(16, rect.top + 20)}px`;
            button.style.left = `${Math.max(16, rect.right - button.offsetWidth - 20)}px`;
            button.style.bottom = 'auto';
            button.style.right = 'auto';

            // If the player is off-screen, pin the button to the viewport corner instead
            if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
                button.style.top = 'auto';
                button.style.left = 'auto';
                button.style.right = '24px';
                button.style.bottom = '24px';
            }
        }

        // Creates the transcript drawer DOM only once, and wires its interactions
        function ensureTranscriptDrawer() {
            if (transcriptState.drawer) return;

            const drawer = document.createElement('aside');
            drawer.id = 'vv-transcript-drawer';
            drawer.innerHTML = `
                <div class="vv-transcript-header">
                    <div class="vv-transcript-row">
                        <h2 class="vv-transcript-title">Audio Transcript</h2>
                        <button type="button" class="vv-transcript-close" aria-label="Close">×</button>
                    </div>
                    <div class="vv-transcript-status">Waiting to start</div>
                    <p class="vv-transcript-summary">Open a transcript, click any word, and VocabVault will pause the video while you save it.</p>
                </div>
                <div class="vv-transcript-body">
                    <p class="vv-transcript-hint">Click a word to pause the media, open the add-to-deck popup, then resume playback after the popup closes.</p>
                    <div class="vv-transcript-content">
                        <div class="vv-empty">Transcript data will appear here.</div>
                    </div>
                </div>
            `;

            // Close button hides the drawer
            drawer.querySelector('.vv-transcript-close').addEventListener('click', closeTranscriptDrawer);
            // Clicking transcript words routes through the shared translation popup flow
            drawer.querySelector('.vv-transcript-content').addEventListener('click', handleTranscriptWordClick);
            // Dragging starts from the drawer header
            drawer.querySelector('.vv-transcript-header').addEventListener('pointerdown', beginTranscriptDrag);
            document.body.appendChild(drawer);

            // Cache frequently accessed DOM nodes for faster updates later
            transcriptState.drawer = drawer;
            transcriptState.statusEl = drawer.querySelector('.vv-transcript-status');
            transcriptState.summaryEl = drawer.querySelector('.vv-transcript-summary');
            transcriptState.bodyEl = drawer.querySelector('.vv-transcript-content');
            transcriptState.hintEl = drawer.querySelector('.vv-transcript-hint');
        }

        // Toggle handler for the floating transcript button
        function toggleTranscriptDrawer() {
            if (isDrawerOpen()) {
                closeTranscriptDrawer();
            } else {
                openTranscriptDrawer();
            }
        }

        // Returns whether the transcript drawer is currently visible
        function isDrawerOpen() {
            return transcriptState.drawer?.classList.contains('vv-open');
        }

        // Opens the drawer, applies the current position, and begins transcript loading
        function openTranscriptDrawer() {
            // If the page has no active media, show a non-blocking notification instead
            if (!transcriptState.mediaElement) {
                showNotification('No active audio or video found on this page.');
                return;
            }

            // Build the drawer if needed, then reveal it
            ensureTranscriptDrawer();
            transcriptState.drawer.classList.add('vv-open');
            // Update the floating button so it reads "Close Transcript"
            updateTranscriptButtonLabel();
            // Reapply any user-dragged drawer position from this page session
            applyDrawerPosition();
            // Keep button placement fresh after the drawer opens
            positionTranscriptButton();
            // Begin loading captions or starting live streaming
            startTranscriptExperience();
        }

        // Hides the drawer and stops any active live transcription session
        function closeTranscriptDrawer() {
            if (!transcriptState.drawer) return;
            transcriptState.drawer.classList.remove('vv-open');
            updateTranscriptButtonLabel();
            stopLiveStreaming();
        }

        // Main transcript startup flow: captions first on YouTube, otherwise AssemblyAI live streaming
        async function startTranscriptExperience() {
            // Show loading status immediately so the user gets feedback
            setTranscriptStatus('Loading transcript...');
            setTranscriptSummary('Looking for native captions first, then switching to AssemblyAI live streaming if needed.');

            // Try native captions on YouTube before using paid live transcription
            if (location.hostname.includes('youtube.com')) {
                const captionLoaded = await hydrateYouTubeCaptions();
                if (captionLoaded) {
                    transcriptState.usingLiveTranscription = false;
                    updateTranscriptHighlight();
                    return;
                }
            }

            // For live transcription, confirm the user saved an API key first
            const settings = await getTranscriptionSettings();
            if (!settings.apiKey) {
                renderMissingSettings();
                return;
            }

            // Mark the session as live-transcription-backed and connect the websocket
            transcriptState.usingLiveTranscription = true;
            setTranscriptStatus('Connecting live transcript...');
            setTranscriptSummary('Starting AssemblyAI real-time transcription from the current playback position.');
            ensureLiveStreaming();
        }

        // Shows the missing-settings state when the user has not configured AssemblyAI credentials
        function renderMissingSettings() {
            ensureTranscriptDrawer();
            const settingsUrl = `${chrome.runtime.getURL('homepage.html')}#transcription-settings`;
            setTranscriptMessage(
                'Transcription needs an API key',
                'Add your speech-to-text API key in the extension settings, then reopen this transcript.'
            );
            setTranscriptBody(`
                <div class="vv-empty">
                    <p>Add a speech-to-text API key before live transcription can start.</p>
                    <div class="vv-transcript-actions">
                        <a class="vv-link-btn" href="${settingsUrl}" target="_blank" rel="noreferrer">Open Settings</a>
                        <button type="button" class="vv-secondary-btn" id="vv-retry-transcript">Retry</button>
                    </div>
                </div>
            `, () => {
                transcriptState.bodyEl.querySelector('#vv-retry-transcript').addEventListener('click', startTranscriptExperience);
            });
        }

        // Updates only the transcript drawer status line
        function setTranscriptStatus(message) {
            ensureTranscriptDrawer();
            transcriptState.statusEl.textContent = message;
        }

        // Updates only the transcript drawer summary line
        function setTranscriptSummary(message) {
            ensureTranscriptDrawer();
            transcriptState.summaryEl.textContent = message;
        }

        // Convenience helper for updating both the status and summary at the same time
        function setTranscriptMessage(status, summary) {
            setTranscriptStatus(status);
            setTranscriptSummary(summary);
        }

        // Replaces the drawer body HTML and optionally runs follow-up DOM wiring
        function setTranscriptBody(html, onReady) {
            ensureTranscriptDrawer();
            transcriptState.bodyEl.innerHTML = html;
            onReady?.();
        }

        // Keeps the floating button label aligned with the drawer open/closed state
        function updateTranscriptButtonLabel() {
            if (transcriptState.button) {
                transcriptState.button.textContent = isDrawerOpen() ? 'Close Transcript' : 'Open Transcript';
            }
        }

        // Attempts to load YouTube caption tracks and normalize them into clickable words
        async function hydrateYouTubeCaptions() {
            try {
                // Ask the page context for caption track metadata
                const tracks = await requestYouTubeCaptionTracks();
                if (!tracks.length) return false;

                // Prefer English when available, otherwise fall back to the first track
                const selectedTrack = chooseCaptionTrack(tracks);
                const jsonUrl = new URL(selectedTrack.baseUrl);
                jsonUrl.searchParams.set('fmt', 'json3');

                const response = await fetch(jsonUrl.toString());
                const payload = await response.json();
                const normalized = normalizeYouTubeTranscript(payload);
                if (!normalized.words.length) return false;

                // Save normalized transcript data into state for rendering and highlighting
                transcriptState.words = normalized.words;
                transcriptState.segments = normalized.segments;
                transcriptState.wordId = normalized.words.length;

                // Render the transcript immediately and report the caption source
                renderTranscript();
                setTranscriptMessage(
                    `Using YouTube captions${selectedTrack.name?.simpleText ? `: ${selectedTrack.name.simpleText}` : ''}`,
                    'Native captions loaded instantly. Click any word to capture it in your deck.'
                );
                return true;
            } catch (error) {
                console.warn('Unable to load YouTube captions:', error);
                return false;
            }
        }

        // Injects a page-context script to read YouTube caption track data that content scripts cannot access directly
        function requestYouTubeCaptionTracks() {
            return new Promise((resolve) => {
                // Timeout so the UI can fall back to streaming if caption discovery fails
                const timeoutId = window.setTimeout(() => {
                    window.removeEventListener('message', onMessage);
                    resolve([]);
                }, 1200);

                // Listen for the caption track payload sent back from the injected page script
                const onMessage = (event) => {
                    if (event.source !== window || event.data?.source !== VV_TRANSCRIPT_SOURCE || event.data.type !== 'youtube-caption-tracks') {
                        return;
                    }
                    window.clearTimeout(timeoutId);
                    window.removeEventListener('message', onMessage);
                    resolve(event.data.tracks || []);
                };

                window.addEventListener('message', onMessage);

                // Inject a short script into the page context so it can read YouTube's player response data
                const script = document.createElement('script');
                script.textContent = `
                    (() => {
                        const response = window.ytInitialPlayerResponse
                            || window.ytplayer?.config?.args?.raw_player_response
                            || window.ytplayer?.config?.args?.player_response;
                        let payload = response;
                        if (typeof payload === 'string') {
                            try {
                                payload = JSON.parse(payload);
                            } catch (error) {
                                payload = null;
                            }
                        }
                        const tracks = payload?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
                        window.postMessage({
                            source: '${VV_TRANSCRIPT_SOURCE}',
                            type: 'youtube-caption-tracks',
                            tracks
                        }, '*');
                    })();
                `;
                document.documentElement.appendChild(script);
                script.remove();
            });
        }

        // Picks the preferred caption track for transcript rendering
        function chooseCaptionTrack(tracks) {
            return tracks.find((track) => track.languageCode === 'en') || tracks[0];
        }

        // Converts YouTube caption events into normalized transcript segments and clickable word timings
        function normalizeYouTubeTranscript(payload) {
            const segments = [];
            const words = [];
            (payload?.events || []).forEach((event) => {
                // Join all caption event pieces into a single line of text
                const rawText = (event.segs || []).map((segment) => segment.utf8 || '').join('').replace(/\n+/g, ' ').trim();
                if (!rawText) return;

                // Convert YouTube's millisecond cue timing into seconds
                const start = (event.tStartMs || 0) / 1000;
                const duration = (event.dDurationMs || 0) / 1000;
                const end = start + Math.max(duration, 0.5);
                // Split the caption cue into individual clickable words
                const tokens = tokenizeTranscriptText(rawText);
                if (!tokens.length) return;

                // Approximate per-word timing by distributing the cue duration across all words
                const segmentIndex = segments.length;
                const span = (end - start) / tokens.length;
                segments.push({ start, end, text: rawText });

                tokens.forEach((token, index) => {
                    const tokenStart = start + (span * index);
                    words.push({
                        id: words.length,
                        text: token,
                        start: tokenStart,
                        end: tokenStart + span,
                        segmentIndex
                    });
                });
            });

            return { segments, words };
        }

        // Starts a real-time AssemblyAI websocket session for the active media element
        async function ensureLiveStreaming() {
            // Only connect when there is media, the drawer is open, and live transcription is needed
            if (!transcriptState.mediaElement || !transcriptState.usingLiveTranscription || !isDrawerOpen()) return;
            // Do not create a second socket if one is already opening or open
            if (transcriptState.websocket && (transcriptState.websocket.readyState === WebSocket.OPEN || transcriptState.websocket.readyState === WebSocket.CONNECTING)) return;

            try {
                const media = transcriptState.mediaElement;
                // Streaming requires captureStream support from the current media element
                if (!media.captureStream) {
                    throw new Error('This site does not expose a capturable media stream.');
                }

                // Load saved credentials and endpoint settings from extension storage
                const settings = await getTranscriptionSettings();
                if (!settings.apiKey) {
                    renderMissingSettings();
                    return;
                }

                // Ask the background script for a temporary AssemblyAI streaming token
                const tokenResponse = await sendMessage({
                    action: 'getStreamingToken',
                    apiKey: settings.apiKey,
                    endpoint: settings.endpoint,
                    model: settings.model,
                    expiresInSeconds: 600
                });

                if (!tokenResponse.success || !tokenResponse.token) {
                    throw new Error(tokenResponse.error || 'Unable to create a streaming session.');
                }

                // Capture the current media element's audio track for streaming transcription
                const stream = media.captureStream();
                const audioTracks = stream.getAudioTracks();
                if (!audioTracks.length) {
                    throw new Error('The current media element has no audio track to transcribe.');
                }

                // Build the websocket URL and connect to AssemblyAI streaming
                const audioStream = new MediaStream(audioTracks);
                const socketUrl = buildStreamingSocketUrl(tokenResponse.websocketUrl, tokenResponse.token, tokenResponse.model || settings.model);
                const socket = new WebSocket(socketUrl);

                // Store live-streaming state so future updates and cleanup know what to manage
                transcriptState.captureStream = audioStream;
                transcriptState.websocket = socket;
                transcriptState.websocketUrl = socketUrl;
                transcriptState.websocketIntentionalClose = false;
                transcriptState.streamBaseTime = media.currentTime || 0;
                transcriptState.streamTurns = [];

                // Use binary ArrayBuffer frames for PCM audio
                socket.binaryType = 'arraybuffer';
                socket.addEventListener('open', () => {
                    setTranscriptMessage(
                        'Live transcription active',
                        'AssemblyAI streaming is listening in real time. Words appear as turns finalize.'
                    );
                    // Start converting captured media audio into PCM frames once the socket is ready
                    startAudioProcessing(audioStream, socket);
                });
                // Handle incoming partial/final transcript messages from the websocket
                socket.addEventListener('message', (event) => handleStreamingSocketMessage(event.data));
                socket.addEventListener('error', () => {
                    setTranscriptMessage(
                        'Streaming connection error',
                        'AssemblyAI rejected the live stream. Check your API key and model settings.'
                    );
                });
                socket.addEventListener('close', () => {
                    const intentional = transcriptState.websocketIntentionalClose;
                    teardownStreamingGraph();
                    transcriptState.websocket = null;
                    transcriptState.websocketUrl = '';
                    transcriptState.websocketIntentionalClose = false;

                    if (!intentional && isDrawerOpen() && transcriptState.usingLiveTranscription) {
                        setTranscriptMessage(
                            'Streaming disconnected',
                            'The live socket closed unexpectedly. Retry to reconnect.'
                        );
                        renderTranscriptError('The AssemblyAI streaming session closed unexpectedly.');
                    }
                });
            } catch (error) {
                // Surface startup failures to the transcript drawer
                console.error('Live streaming setup error:', error);
                setTranscriptMessage('Unable to start live transcription', error.message);
                renderTranscriptError(error.message);
            }
        }

        // Ends the current websocket session and tears down all associated audio-processing nodes
        function stopLiveStreaming() {
            // Mark the close as intentional so the close handler does not show an error state
            transcriptState.websocketIntentionalClose = true;
            // Politely ask AssemblyAI to terminate the session if the socket is open
            if (transcriptState.websocket && transcriptState.websocket.readyState === WebSocket.OPEN) {
                transcriptState.websocket.send(JSON.stringify({ type: 'Terminate' }));
            }
            // Close sockets that are still active or still connecting
            if (transcriptState.websocket && transcriptState.websocket.readyState < WebSocket.CLOSED) {
                transcriptState.websocket.close();
            }
            // Release audio resources and clear websocket references
            teardownStreamingGraph();
            transcriptState.websocket = null;
            transcriptState.websocketUrl = '';
        }

        // Builds a Web Audio graph that converts captured media into the PCM frames AssemblyAI expects
        function startAudioProcessing(audioStream, socket) {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextCtor) {
                throw new Error('This browser does not support Web Audio processing for live transcription.');
            }

            // Use Web Audio to tap into the media stream and process raw samples
            const audioContext = new AudioContextCtor();
            // Resume immediately in case the audio context starts suspended
            audioContext.resume().catch(() => { });
            const sourceNode = audioContext.createMediaStreamSource(audioStream);
            const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
            const sinkNode = audioContext.createGain();
            // Keep the processing graph silent to the user
            sinkNode.gain.value = 0;

            // On every audio callback, downsample and convert the PCM before sending it to the socket
            processorNode.onaudioprocess = (event) => {
                if (!transcriptState.websocket || transcriptState.websocket.readyState !== WebSocket.OPEN) return;
                const input = event.inputBuffer.getChannelData(0);
                const downsampled = downsampleAudioBuffer(input, audioContext.sampleRate, VV_STREAM_SAMPLE_RATE);
                if (!downsampled.length) return;
                const pcmBytes = convertFloat32ToInt16Buffer(downsampled);
                if (pcmBytes.byteLength) socket.send(pcmBytes.buffer);
            };

            // Connect the graph: media source -> processor -> silent sink
            sourceNode.connect(processorNode);
            processorNode.connect(sinkNode);
            sinkNode.connect(audioContext.destination);

            // Cache audio nodes for cleanup later
            transcriptState.audioContext = audioContext;
            transcriptState.audioSourceNode = sourceNode;
            transcriptState.audioProcessorNode = processorNode;
            transcriptState.audioSinkNode = sinkNode;
        }

        // Disconnects and disposes all resources tied to the live audio processing graph
        function teardownStreamingGraph() {
            transcriptState.audioProcessorNode?.disconnect();
            transcriptState.audioSourceNode?.disconnect();
            transcriptState.audioSinkNode?.disconnect();
            // Stop captured audio tracks so they do not remain active after the drawer closes
            transcriptState.captureStream?.getTracks().forEach((track) => track.stop());
            // Close the audio context to release browser audio resources
            if (transcriptState.audioContext) {
                transcriptState.audioContext.close().catch(() => { });
            }
            // Clear cached graph references
            transcriptState.captureStream = null;
            transcriptState.audioContext = null;
            transcriptState.audioSourceNode = null;
            transcriptState.audioProcessorNode = null;
            transcriptState.audioSinkNode = null;
        }

        // Routes incoming websocket messages by AssemblyAI message type
        function handleStreamingSocketMessage(rawMessage) {
            let payload = null;
            try {
                payload = JSON.parse(rawMessage);
            } catch (error) {
                console.warn('Unable to parse streaming message:', rawMessage);
                return;
            }

            const messageType = payload.type || payload.message_type;
            // Session handshake message received when streaming is ready
            if (messageType === 'Begin') {
                setTranscriptMessage('Live transcription active', 'AssemblyAI is streaming transcript turns in real time.');
                return;
            }
            // Transcript turn payload containing recognized words
            if (messageType === 'Turn') {
                ingestStreamingTurn(payload);
                return;
            }
            // Session ended cleanly
            if (messageType === 'Termination') {
                setTranscriptMessage('Live transcription paused', 'The current streaming session ended.');
                return;
            }
            // Error payload from AssemblyAI
            if (messageType === 'Error') {
                const errorMessage = payload.error || payload.message || 'AssemblyAI reported a streaming error.';
                setTranscriptMessage('Streaming error', errorMessage);
                renderTranscriptError(errorMessage);
            }
        }

        // Converts a finalized streaming turn into transcript segments and clickable words
        function ingestStreamingTurn(payload) {
            // Use only finalized words so the transcript does not flicker while the user watches
            const rawWords = Array.isArray(payload.words) ? payload.words : [];
            const finalizedWords = rawWords.filter((word) => word.word_is_final !== false && (word.text || word.word));
            if (!finalizedWords.length) return;

            // Use turn order so repeated updates can replace the same transcript turn deterministically
            const order = Number(payload.turn_order ?? transcriptState.streamTurns.length);
            const words = finalizedWords.map((word) => ({
                text: (word.text || word.word || '').trim(),
                start: transcriptState.streamBaseTime + (Number(word.start ?? 0) / 1000),
                end: transcriptState.streamBaseTime + (Number(word.end ?? word.start ?? 0) / 1000)
            })).filter((word) => word.text);
            if (!words.length) return;

            // Replace an existing turn if AssemblyAI re-sent the same turn order, otherwise append it
            const existingIndex = transcriptState.streamTurns.findIndex((turn) => turn.order === order);
            const nextTurn = {
                order,
                text: words.map((word) => word.text).join(' '),
                start: words[0].start,
                end: words.at(-1).end,
                words
            };

            if (existingIndex === -1) {
                transcriptState.streamTurns.push(nextTurn);
            } else {
                transcriptState.streamTurns[existingIndex] = nextTurn;
            }

            // Sort turns, rebuild the display model, and refresh transcript rendering
            transcriptState.streamTurns.sort((left, right) => left.order - right.order);
            rebuildTranscriptFromStreamTurns();
            setTranscriptMessage('Live transcription active', '');
        }

        // Rebuilds the normalized transcript arrays from the accumulated streaming turns
        function rebuildTranscriptFromStreamTurns() {
            transcriptState.words = [];
            transcriptState.segments = [];
            transcriptState.wordId = 0;

            // Recreate segments and words in display order so the drawer stays consistent
            transcriptState.streamTurns.forEach((turn, segmentIndex) => {
                transcriptState.segments.push({
                    start: turn.start,
                    end: Math.max(turn.end, turn.start + 0.05),
                    text: turn.text
                });

                turn.words.forEach((word) => {
                    transcriptState.words.push({
                        id: transcriptState.wordId++,
                        text: word.text,
                        start: word.start,
                        end: Math.max(word.end, word.start + 0.05),
                        segmentIndex
                    });
                });
            });

            renderTranscript();
        }

        // Renders all transcript segments and clickable words into the drawer body
        function renderTranscript() {
            ensureTranscriptDrawer();
            // Show the empty state when no transcript segments exist yet
            if (!transcriptState.segments.length) {
                setTranscriptBody('<div class="vv-empty">Transcript data will appear here.</div>');
                return;
            }

            // Render one section per segment, with each word as an individual button
            setTranscriptBody(transcriptState.segments.map((segment, segmentIndex) => {
                const words = transcriptState.words.filter((word) => word.segmentIndex === segmentIndex);
                const wordsHtml = words.map((word) => `
                    <button type="button" class="vv-word" data-word-id="${word.id}">
                        ${escapeHtml(word.text)}
                    </button>
                `).join('');

                return `
                    <section class="vv-segment" data-segment-index="${segmentIndex}">
                        <div class="vv-segment-time">${formatTimestamp(segment.start)}</div>
                        <div>${wordsHtml}</div>
                    </section>
                `;
            }).join(''));

            updateTranscriptHighlight();
        }

        // Renders an error state inside the transcript drawer and wires the retry button
        function renderTranscriptError(message) {
            setTranscriptBody(`
                <div class="vv-empty">
                    <p>${escapeHtml(message)}</p>
                    <div class="vv-transcript-actions">
                        <button type="button" class="vv-secondary-btn" id="vv-retry-live-transcript">Try Again</button>
                    </div>
                </div>
            `, () => {
                transcriptState.bodyEl.querySelector('#vv-retry-live-transcript').addEventListener('click', startTranscriptExperience);
            });
        }

        // Handles clicks on transcript words by pausing playback and opening the shared translation popup
        function handleTranscriptWordClick(event) {
            const button = event.target.closest('.vv-word');
            if (!button) return;

            // Resolve the clicked word from its stored ID
            const wordId = Number(button.dataset.wordId);
            const word = transcriptState.words.find((entry) => entry.id === wordId);
            if (!word || !transcriptState.mediaElement) return;

            const media = transcriptState.mediaElement;
            // Resume only if the transcript click itself paused an already-playing media element
            const shouldResume = !media.paused && !media.ended;
            media.pause();
            showTranslation(word.text, {
                onClose: () => {
                    if (shouldResume) {
                        media.play().catch(() => { });
                    }
                }
            });
        }

        // Highlights the transcript segment that matches the media element's current playback time
        function updateTranscriptHighlight() {
            if (!transcriptState.drawer || !transcriptState.segments.length || !transcriptState.mediaElement) return;
            const currentTime = transcriptState.mediaElement.currentTime || 0;
            // Find the segment that contains the current playback time
            let activeIndex = transcriptState.segments.findIndex((segment) => currentTime >= segment.start && currentTime <= segment.end);
            // Once playback passes the last segment, keep the last segment highlighted
            if (activeIndex === -1 && currentTime > transcriptState.segments.at(-1).end) {
                activeIndex = transcriptState.segments.length - 1;
            }
            // Skip DOM work if the highlighted segment did not change
            if (activeIndex === transcriptState.activeSegmentIndex) return;

            transcriptState.activeSegmentIndex = activeIndex;
            // Toggle the active class across all rendered segments
            transcriptState.drawer.querySelectorAll('.vv-segment').forEach((node) => {
                node.classList.toggle('vv-active', Number(node.dataset.segmentIndex) === activeIndex);
            });
        }

        // Clears transcript-specific state when media changes or the page navigates
        function resetTranscriptSession() {
            stopLiveStreaming();
            transcriptState.words = [];
            transcriptState.segments = [];
            transcriptState.wordId = 0;
            transcriptState.activeSegmentIndex = -1;
            transcriptState.usingLiveTranscription = false;
            transcriptState.streamTurns = [];
            transcriptState.streamBaseTime = transcriptState.mediaElement?.currentTime || 0;

            // Reset drawer contents to the default empty state
            if (transcriptState.bodyEl) {
                setTranscriptBody('<div class="vv-empty">Transcript data will appear here.</div>');
            }
            // Reset drawer messaging back to the default intro state
            if (transcriptState.statusEl) {
                setTranscriptMessage(
                    'Waiting to start',
                    'Open a transcript, click any word, and VocabVault will pause the video while you save it.'
                );
            }
        }

        // Starts dragging the transcript drawer from its header
        function beginTranscriptDrag(event) {
            if (!transcriptState.drawer || event.target.closest('.vv-transcript-close')) return;
            const rect = transcriptState.drawer.getBoundingClientRect();
            // Track the pointer and cursor offset relative to the drawer's top-left corner
            transcriptState.dragPointerId = event.pointerId;
            transcriptState.dragOffsetX = event.clientX - rect.left;
            transcriptState.dragOffsetY = event.clientY - rect.top;
            // Capture the pointer so dragging still works if the cursor leaves the header area
            transcriptState.drawer.setPointerCapture(event.pointerId);
            transcriptState.drawer.addEventListener('pointermove', handleTranscriptDrag);
            transcriptState.drawer.addEventListener('pointerup', endTranscriptDrag);
            transcriptState.drawer.addEventListener('pointercancel', endTranscriptDrag);
        }

        // Repositions the drawer while the user drags it
        function handleTranscriptDrag(event) {
            if (event.pointerId !== transcriptState.dragPointerId || !transcriptState.drawer) return;
            // Clamp the drawer so it stays within the viewport bounds
            const maxLeft = Math.max(12, window.innerWidth - transcriptState.drawer.offsetWidth - 12);
            const maxTop = Math.max(12, window.innerHeight - transcriptState.drawer.offsetHeight - 12);
            const left = clamp(event.clientX - transcriptState.dragOffsetX, 12, maxLeft);
            const top = clamp(event.clientY - transcriptState.dragOffsetY, 12, maxTop);
            // Persist the new position for the current page session
            transcriptState.drawerPosition = { left, top };
            applyDrawerPosition();
        }

        // Stops drawer dragging and removes temporary pointer listeners
        function endTranscriptDrag(event) {
            if (!transcriptState.drawer || event.pointerId !== transcriptState.dragPointerId) return;
            transcriptState.drawer.releasePointerCapture(event.pointerId);
            transcriptState.drawer.removeEventListener('pointermove', handleTranscriptDrag);
            transcriptState.drawer.removeEventListener('pointerup', endTranscriptDrag);
            transcriptState.drawer.removeEventListener('pointercancel', endTranscriptDrag);
            transcriptState.dragPointerId = null;
        }

        // Applies either the saved drawer position or the default top-right placement
        function applyDrawerPosition() {
            if (!transcriptState.drawer) return;
            if (!transcriptState.drawerPosition) {
                // Use the default anchored position when the user has not dragged the drawer yet
                transcriptState.drawer.style.left = '';
                transcriptState.drawer.style.top = '';
                transcriptState.drawer.style.right = '24px';
                transcriptState.drawer.style.bottom = '';
                return;
            }
            // Use the custom drag position when available
            transcriptState.drawer.style.left = `${transcriptState.drawerPosition.left}px`;
            transcriptState.drawer.style.top = `${transcriptState.drawerPosition.top}px`;
            transcriptState.drawer.style.right = 'auto';
            transcriptState.drawer.style.bottom = 'auto';
        }

        // Restricts a numeric value to a bounded range
        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        // Splits transcript text into word-like tokens suitable for clickable transcript buttons
        function tokenizeTranscriptText(text) {
            return Array.from(text.matchAll(VV_WORD_PATTERN), (match) => match[0]);
        }

        // Formats transcript timestamps as M:SS
        function formatTimestamp(seconds) {
            const total = Math.max(0, Math.floor(seconds));
            const minutes = Math.floor(total / 60);
            const remaining = total % 60;
            return `${minutes}:${remaining.toString().padStart(2, '0')}`;
        }

        // Loads saved transcription settings from extension storage
        function getTranscriptionSettings() {
            return new Promise((resolve) => {
                chrome.storage.local.get({
                    transcriptionApiKey: '',
                    transcriptionEndpoint: VV_DEFAULT_STT_ENDPOINT,
                    transcriptionModel: VV_DEFAULT_STT_MODEL
                }, (data) => {
                    resolve({
                        apiKey: data.transcriptionApiKey || '',
                        endpoint: data.transcriptionEndpoint || VV_DEFAULT_STT_ENDPOINT,
                        model: data.transcriptionModel || VV_DEFAULT_STT_MODEL
                    });
                });
            });
        }

        // Wraps chrome.runtime.sendMessage in a Promise for async/await transcript flows
        function sendMessage(payload) {
            return new Promise((resolve) => {
                chrome.runtime.sendMessage(payload, (response) => {
                    resolve(response || { success: false, error: 'No response from extension background worker.' });
                });
            });
        }

        // Builds the AssemblyAI websocket URL using the temporary token and selected model
        function buildStreamingSocketUrl(baseUrl, token, model) {
            const socketUrl = new URL((baseUrl || 'wss://streaming.assemblyai.com').replace(/^http/, 'ws'));
            socketUrl.pathname = '/v3/ws';
            socketUrl.searchParams.set('sample_rate', String(VV_STREAM_SAMPLE_RATE));
            socketUrl.searchParams.set('format_turns', 'true');
            socketUrl.searchParams.set('token', token);
            if (model) {
                socketUrl.searchParams.set('speech_model', model);
            }
            return socketUrl.toString();
        }

        // Downsamples browser audio to the sample rate expected by the streaming API
        function downsampleAudioBuffer(sourceBuffer, sourceRate, targetRate) {
            // If the sample rate is already low enough, no resampling is needed
            if (sourceRate === targetRate || targetRate > sourceRate) {
                return sourceBuffer.slice();
            }

            // Average sample ranges together to reduce the sample rate
            const sampleRateRatio = sourceRate / targetRate;
            const targetLength = Math.round(sourceBuffer.length / sampleRateRatio);
            const result = new Float32Array(targetLength);
            let targetIndex = 0;
            let sourceIndex = 0;

            while (targetIndex < result.length) {
                const nextSourceIndex = Math.round((targetIndex + 1) * sampleRateRatio);
                let accumulated = 0;
                let count = 0;

                for (let index = sourceIndex; index < nextSourceIndex && index < sourceBuffer.length; index += 1) {
                    accumulated += sourceBuffer[index];
                    count += 1;
                }

                result[targetIndex] = count ? accumulated / count : 0;
                targetIndex += 1;
                sourceIndex = nextSourceIndex;
            }

            return result;
        }

        // Converts normalized Float32 audio samples into signed 16-bit PCM integers
        function convertFloat32ToInt16Buffer(floatBuffer) {
            const result = new Int16Array(floatBuffer.length);
            for (let index = 0; index < floatBuffer.length; index += 1) {
                const sample = Math.max(-1, Math.min(1, floatBuffer[index]));
                result[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            }
            return result;
        }
    }

    // Expose the module init function so content.js can pass in shared popup helpers
    window.VocabVaultTranscript = { init };
})();
