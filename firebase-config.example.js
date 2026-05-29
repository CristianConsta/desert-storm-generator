// Firebase config (copy real values into this file locally; do not commit secrets)
const FIREBASE_CONFIG = {
    apiKey: "REPLACE_ME",
    authDomain: "REPLACE_ME",
    projectId: "REPLACE_ME",
    storageBucket: "REPLACE_ME",
    messagingSenderId: "REPLACE_ME",
    appId: "REPLACE_ME"
};

// DeepL API key for wiki translations (free tier: 500K chars/month)
// Get yours at https://www.deepl.com/pro-api
const DEEPL_API_KEY = "REPLACE_ME";

if (typeof window !== 'undefined') {
    window.FIREBASE_CONFIG = FIREBASE_CONFIG;
    window.DEEPL_API_KEY = DEEPL_API_KEY;
}
