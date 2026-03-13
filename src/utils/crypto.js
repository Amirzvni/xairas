import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFileSync } from 'fs';

let keyCache = null;

function getKey() {
    if (keyCache) return keyCache;
    const machineId = readFileSync('/etc/machine-id', 'utf-8').trim();
    keyCache = scryptSync(machineId, 'xairas-salt', 32);
    return keyCache;
}

export function encrypt(text) {
    const key = getKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return 'encrypted:' + iv.toString('hex') + ':' + encrypted;
}

export function decrypt(stored) {
    if (!stored.startsWith('encrypted:')) return stored;
    const parts = stored.slice('encrypted:'.length).split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const data = parts[1];
    const key = getKey();
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(data, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
}