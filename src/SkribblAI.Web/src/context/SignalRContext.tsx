import React, { createContext, useEffect, useState, ReactNode } from "react";
import * as signalR from "@microsoft/signalr";
import type { DrawingCommand } from "@/models/drawingCommand";

interface SignalRContextType {
  connection: signalR.HubConnection | null;
  sendDrawingCommand: (command: DrawingCommand) => Promise<void>;
  clearCanvas: () => Promise<void>;
}

export const SignalRContext = createContext<SignalRContextType | null>(null);

export const SignalRProvider = ({ children }: { children: ReactNode }) => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(
    null
  );

  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl("/hubs/drawing")
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    newConnection
      .start()
      .then(() => {
        console.log("SignalR Connected");
        setConnection(newConnection);
      })
      .catch((err) => console.error("SignalR Connection Error: ", err));

    return () => {
      newConnection.stop();
    };
  }, []);

  const sendDrawingCommand = async (command: DrawingCommand) => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("SendDrawingCommand", command);
    }
  };

  const clearCanvas = async () => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("ClearCanvas");
    }
  };

  return (
    <SignalRContext.Provider
      value={{ connection, sendDrawingCommand, clearCanvas }}
    >
      {children}
    </SignalRContext.Provider>
  );
};
