export interface ChatMessage {
    id: string;
    username: string;
    message: string;
    timestamp: Date;
    type: "chat" | "system" | "correct-guess" | "close-guess" | "guessed-chat" | "join" | "leave" | "owner-change" | "round-start" | "round-end" | "turn-start";
} 