 export interface ChatMessage { 
    id: string; 
    username: string; 
    message: string; 
    timestamp: Date; 
    type: "chat" | "system" | "correct-guess"; 
} 