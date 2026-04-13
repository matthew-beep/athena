'use client';

import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useState, useEffect } from 'react';



export default function Home() {

    const user = useAuthStore((s) => s.user);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    useEffect(() => {
        console.log("suggestions", suggestions);
    }, [suggestions]);


    return (
    <div className="flex flex-col h-full border-2 border-red-500">
        <header className="flex flex-col items-center justify-center border">
            <h1 className="text-4xl font-bold">Welcome {user?.username}</h1>
        </header>
        <main className="flex flex-col flex-1 border">
            <button onClick={() => {
                apiClient.post("/chat/suggestions", {
                    conversation_id: 1,
                    last_user_message: "Hello",
                    last_assistant_message: "Hello",
                });
            }}>Suggestions</button>
        </main>
    </div>
    );
}