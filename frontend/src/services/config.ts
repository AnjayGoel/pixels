export interface Config {
    gridWidth: number;
    gridHeight: number;
    pixelCooldown: number;
    colorMap: Record<number, string>;
}

let config: Config | null = null;

export async function fetchConfig(): Promise<Config> {
    if (config) return config;
    
    const response = await fetch('http://localhost:8080/api/config');
    if (!response.ok) {
        throw new Error('Failed to fetch config');
    }
    
    const newConfig = await response.json() as Config;
    config = newConfig;
    return newConfig;
}

export function getConfig(): Config {
    if (!config) {
        throw new Error('Config not loaded. Call fetchConfig() first.');
    }
    return config;
} 