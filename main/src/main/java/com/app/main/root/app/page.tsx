"use client"
import { Main } from "./main/_main";
import { PasswordResetController } from "./main/password-reset-controller";
import { ApiClientController } from "./main/_api-client/api-client-controller";
import { SocketClientConnect } from "./main/socket-client-connect";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function Home() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  const [socketClientConnect, setSocketClientConnect] = useState<SocketClientConnect | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    const socketClient = new SocketClientConnect();
    
    const connectSocket = async () => {
      try {
        await socketClient.connect();
        setSocketClientConnect(socketClient);
        console.log("Socket connected successfully");
      } catch(error) {
        console.error("Failed to connect socket:", error);
      } finally {
        setIsConnecting(false);
      }
    };

    connectSocket();

    return () => {
      if(socketClient) {
        socketClient.disconnect();
      }
    };
  }, []);

  if(isConnecting) {
    //return <div>Connecting...</div>;
  }
  if(!socketClientConnect) {
    //return <div>Failed to connect. Please refresh the page.</div>;
  }

  const apiClientController = new ApiClientController(socketClientConnect);

  if(token && action === 'reset') {
    return (
      <PasswordResetController 
        apiClientController={apiClientController}
        socketClientConnect={socketClientConnect}
        onBackToLogin={() => window.location.href = '/'}
        token={token}
      />
    );
  }

  return (
    <>
      <Main />
    </>
  );
}