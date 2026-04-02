'use client';

import { useAuthStore } from '@/stores/auth.store';



export default function Home() {

const user = useAuthStore((s) => s.user);

    return (
    <div className="flex flex-col h-full border-2 border-red-500">
        <header className="flex flex-col items-center justify-center border">
            <h1 className="text-4xl font-bold">Welcome {user?.username}</h1>
        </header>
        <main className="flex flex-col flex-1 border">
        </main>
    </div>
    );
}
