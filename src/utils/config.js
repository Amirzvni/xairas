import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs';
import { encrypt, decrypt } from './crypto.js';

const CONFIG_DIR = '/etc/xairas';
const CONFIG_PATH = `${CONFIG_DIR}/config.json`;

const SENSITIVE_KEYS = [
    'telegram.botToken',
    'email.password',
    'email.username'
];

const DEFAULTS = {
    telegram: {
        apiUrl: 'https://api.telegram.org',
        botToken: '',
        chatId: ''
    },
    email: {
        host: '',
        port: 587,
        username: '',
        password: '',
        from: '',
        to: ''
    },
    report: {
        dailyTime: '08:00',
        timezone: 'UTC'
    },
    thresholds: {
        diskioRead: 100,
        diskioWrite: 100
    },
    alerts: {
        newPort: true,
        newTmp: true
    }
};

function ensureDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
        chmodSync(CONFIG_DIR, 0o700);
    }
}

function load() {
    try {
        const raw = readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return JSON.parse(JSON.stringify(DEFAULTS));
    }
}

function save(config) {
    ensureDir();
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    chmodSync(CONFIG_PATH, 0o600);
}

function getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === undefined || current === null) return undefined;
        current = current[key];
    }
    return current;
}

function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined) current[keys[i]] = {};
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

export function configGet(key) {
    const config = load();
    let value = getNestedValue(config, key);
    if (value === undefined) value = getNestedValue(DEFAULTS, key);
    if (typeof value === 'string' && value.startsWith('encrypted:')) {
        return decrypt(value);
    }
    return value;
}

export function configSet(key, value) {
    const config = load();
    if (SENSITIVE_KEYS.includes(key)) {
        value = encrypt(value);
    }
    setNestedValue(config, key, value);
    save(config);
}

export function configList() {
    const config = load();
    const result = {};

    function flatten(obj, prefix = '') {
        for (const [key, val] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                flatten(val, path);
            } else if (typeof val === 'string' && val.startsWith('encrypted:')) {
                result[path] = '********';
            } else {
                result[path] = val;
            }
        }
    }

    flatten(config);
    return result;
}

export function configInit() {
    const config = load();
    // Merge defaults for any missing keys
    function mergeDefaults(target, defaults) {
        for (const [key, val] of Object.entries(defaults)) {
            if (target[key] === undefined) {
                target[key] = JSON.parse(JSON.stringify(val));
            } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                mergeDefaults(target[key], val);
            }
        }
    }
    mergeDefaults(config, DEFAULTS);
    save(config);
    return config;
}