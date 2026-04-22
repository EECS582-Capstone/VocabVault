/*
Name of Code Artifact: background.js
Description: Handles context menu translations and speech-to-text API requests.
Programmer's Name: Jenny Tsotezo, Skylar Franz, Sam Kelemen
Date Created: 02/15/2026
Date Revised: 04/12/2026
Preconditions (inputs): User-selected text or streaming token requests
Postcondition (outputs): Translation results or streaming session data
Errors: n/a
*/

const DEFAULT_STT_ENDPOINT = 'https://api.assemblyai.com';
const DEFAULT_STREAMING_MODEL = 'universal-streaming-multilingual';

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'translate-text',
        title: 'Translate "%s"',
        contexts: ['selection']
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'translate-text') {
        return;
    }

    chrome.tabs.sendMessage(tab.id, {
        action: 'showTranslationCard',
        text: info.selectionText
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translateText') {
        translateText(request.text, request.direction)
            .then((translation) => {
                sendResponse({ success: true, translation });
            })
            .catch((error) => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (request.action === 'detectLanguage') {
        const lang = detectLanguage(request.text);
        sendResponse({ success: true, language: lang });
    }

    if (request.action === 'getStreamingToken') {
        getStreamingToken(request)
            .then((payload) => {
                sendResponse({ success: true, ...payload });
            })
            .catch((error) => {
                console.error('Streaming token error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (request.action === 'getSynonyms') {
        getSynonyms(request.text)
            .then(data => sendResponse({ synonyms: data }))
            .catch(err => sendResponse({ synonyms: [], error: err.message }));
        return true; 
    }
});

async function translateText(text, direction) {
    try {

        let source, target;
        if (direction) {
            [source, target] = direction.split('-');
        } else {
            const lang = detectLanguage(text);
            source = lang === 'es' ? 'es' : 'en';
            target = lang === 'es' ? 'en' : 'es';
        }

        console.log(`Translating "${text}" from ${source} to ${target}`);

        const url = `https://lingva.ml/api/v1/${source}/${target}/${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.translation) {
            console.log(`Got translation: ${data.translation}`);
            return data.translation;
        }
        return '[No translation found]';
    } catch (error) {
        console.error('Translation error:', error);
        return '[Translation error]';
    }
}

function detectLanguage(text) {
    const cleanText = text.trim().toLowerCase();
    
    if (/[áéíóúüñ¿¡]/.test(cleanText)) return 'es';

    const spanishEndings = /(ación|miento|dad|mente|ero|era|ajes|pico|endo|ando|ito|ita)$/i;
    if (spanishEndings.test(cleanText)) return 'es';

    const spanishWords = new Set(['el', 'la', 'de', 'que', 'en', 'y', 'a', 'los', 'se', 'del', 'las', 'un', 'por', 'con', 'no', 'una', 'su', 'para', 'es', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'cursos', 'estaba', 'bien', 'poco', 'estos', 'pueden', 'mis', 'quiero', 'fueron', 'solo', 'nuestra']);
    
    const words = cleanText.split(/\s+/);
    if (words.some(w => spanishWords.has(w))) return 'es';

    return 'en';
}

async function getStreamingToken(request) {
    const apiKey = request.apiKey?.trim();
    if (!apiKey) {
        throw new Error('Missing transcription API key.');
    }

    const expiresInSeconds = Math.min(Math.max(Number(request.expiresInSeconds) || 600, 60), 3600);
    const endpoint = buildStreamingHttpEndpoint(request.endpoint);
    const model = request.model || DEFAULT_STREAMING_MODEL;
    const response = await fetch(`${endpoint}/v3/token?expires_in_seconds=${expiresInSeconds}`, {
        headers: {
            Authorization: apiKey
        }
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.token) {
        const message = payload?.error || payload?.message || `Streaming token request failed with status ${response.status}`;
        throw new Error(message);
    }

    return {
        token: payload.token,
        websocketUrl: buildStreamingWebSocketEndpoint(request.endpoint),
        model
    };
}

function buildStreamingHttpEndpoint(endpoint) {
    try {
        const url = new URL(endpoint || DEFAULT_STT_ENDPOINT);
        if (url.hostname === 'api.assemblyai.com') {
            url.hostname = 'streaming.assemblyai.com';
        }
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch (error) {
        return 'https://streaming.assemblyai.com';
    }
}

function buildStreamingWebSocketEndpoint(endpoint) {
    try {
        const url = new URL(endpoint || DEFAULT_STT_ENDPOINT);
        url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
        if (url.hostname === 'api.assemblyai.com') {
            url.hostname = 'streaming.assemblyai.com';
        }
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch (error) {
        return 'wss://streaming.assemblyai.com';
    }
}

async function getSynonyms(text) {
    text = text.trim();
    const lang = detectLanguage(text);

    let url;
    if (lang == 'es') {
        url = `https://rimar.io/api/words?k=ol-rimario-syn&rel_syn=es/${encodeURIComponent(text)}&max=10`
    }
    else {
        url = `https://www.onelook.com/api/sug?v=ol_gte2_suggest&k=olt_phrases&max=10&s=${encodeURIComponent(text)}`;
    }
    const response = await fetch(url);
    return await response.json();
}