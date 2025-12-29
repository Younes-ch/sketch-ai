export type GamePhase =  
    | "lobby"               // Waiting for players, host can start
    | "wordSelection"       // Drawer is choosing a word 
    | "drawing"             // Active drawing round 
    | "roundEnd"            // Show scores, transition to next 
    | "gameEnd";            // Final scores, game over