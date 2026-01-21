export interface ChatMessage {
    id: string;
    username: string;
    message: string;
    timestamp: Date;
    type: "chat" | "system" | "correct-guess" | "close-guess" | "join" | "leave" | "owner-change" | "round-start" | "round-end" | "turn-start";
} 