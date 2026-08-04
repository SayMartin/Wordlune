import React, { createContext, useContext, useState, ReactNode } from "react";

type LoadingContextType = {
  show: (message?: string) => void;
  hide: () => void;
  isLoading: boolean;
  message?: string;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const show = (msg?: string) => {
    setMessage(msg);
    setIsLoading(true);
  };
  const hide = () => {
    setIsLoading(false);
    setMessage(undefined);
  };

  return (
    <LoadingContext.Provider value={{ show, hide, isLoading, message }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading must be used within LoadingProvider");
  return ctx;
};

export default LoadingContext;
