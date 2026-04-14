'use client';

import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useState, useEffect } from 'react';
import type { SuggestionsResponse } from '@/types';


export default function Home() {

    const user = useAuthStore((s) => s.user);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastResponseMs, setLastResponseMs] = useState<number | null>(null);
    useEffect(() => {
        console.log("suggestions", suggestions);
    }, [suggestions]);
    const handleSuggestions = async () => {
        const started = performance.now();
        try {
            setLoading(true);
            const res = await apiClient.post<SuggestionsResponse>("/chat/suggestions", {
                conversation_id: "1",
                last_user_message: "Hello",
                last_assistant_message: "Hello",
            });
            const elapsedMs = Math.round(performance.now() - started);
            setLastResponseMs(elapsedMs);
            console.log(`suggestions response: ${elapsedMs / 1000}s`);
            setSuggestions(res.suggestions);
        }
        finally {
            setLoading(false);
        }
    }

    return (
    <div className="flex flex-col h-full border-2 border-red-500">
        <header className="flex flex-col items-center justify-center border">
            <h1 className="text-4xl font-bold">Welcome {user?.username}</h1>
        </header>
        <main className="flex flex-col flex-1 border">
            <button className='border-2 border-blue-500 p-2 bg-blue-500 text-white rounded-md' onClick={() => {
                handleSuggestions();
            }}>Suggestions</button>
            {loading && <p>Loading...</p>}
            {lastResponseMs !== null && (
                <p className="text-sm text-muted-foreground">Last response: {lastResponseMs} ms</p>
            )}
            <p>{JSON.stringify(suggestions)}</p>
        </main>
    </div>
    );
}