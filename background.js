/*
Name of Code Artifact: background.js
Description: Handles context menu translations and speech-to-text API requests.
Programmer's Name: Jenny Tsotezo, Skylar Franz, Sam Kelemen
Date Created: 02/15/2026
Date Revised: 03/29/2026
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
        detectLanguage(request.text)
            .then((language) => {
                sendResponse({ success: true, language });
            })
            .catch((error) => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
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

async function translateText(text, direction = 'en-es') {
    const [sourceLang, targetLang] = direction.split('-');

    console.log(`Translating "${text}" from ${sourceLang} to ${targetLang}`);

    try {
        const langPair = `${sourceLang}|${targetLang}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData) {
            return data.responseData.translatedText;
        }

        return '[Translation unavailable]';
    } catch (error) {
        console.error('Translation error:', error);
        return '[Translation error]';
    }
}

async function detectLanguage(text) {
    try {
        const spanishWords = [
            'el', 'la', 'los', 'las',
            'un', 'una',
            'de', 'del', 'al',
            'que', 'pero', 'porque',
            'es', 'son', 'somos',
            'muy', 'todo', 'como',
            'donde', 'cuando',
            'hola', 'si', 'no'
        ];

        const spanishChars = /[áéíóúüñ¿¡]/i;
        for (const word of spanishWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            if (regex.test(text) || spanishChars.test(text)) {
                return 'es';
            }
        }

        return 'en';
    } catch (error) {
        console.error('Language detection error:', error);
        return 'en';
    }
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
    const lang = await detectLanguage(text);

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