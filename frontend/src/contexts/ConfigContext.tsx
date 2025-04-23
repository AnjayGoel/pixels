// ConfigContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Config } from '../services/config'

const ConfigContext = createContext<Config | null>(null)

export function ConfigProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<Config | null>(null)

    useEffect(() => {
        async function fetchConfig() {
            const res = await fetch('http://localhost:8080/api/config')
            const data = await res.json()
            setConfig(data)
        }
        fetchConfig()
    }, [])

    if (!config) {
        // Optional: you can render a loading screen here if config is critical
        return <div>Loading config...</div>
    }

    return (
        <ConfigContext.Provider value={config}>
            {children}
        </ConfigContext.Provider>
    )
}

export function useConfig() {
    const context = useContext(ConfigContext)
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider')
    }
    return context
}
