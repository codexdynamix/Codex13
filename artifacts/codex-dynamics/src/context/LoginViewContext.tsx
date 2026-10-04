import React, { createContext, useContext, useState, useEffect } from "react";

interface LoginViewContextType {
  isLoginActive: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const LoginViewContext = createContext<LoginViewContextType | undefined>(undefined);

export function LoginViewProvider({ children }: { children: React.ReactNode }) {
  const [isLoginActive, setIsLoginActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return (
      urlParams.get("view") === "login" ||
      urlParams.get("login") === "1" ||
      window.location.pathname === "/login"
    );
  });

  const openLogin = () => {
    setIsLoginActive(true);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "login");
      window.history.pushState({}, "", url.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const closeLogin = () => {
    setIsLoginActive(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("view");
      url.searchParams.delete("login");
      const newUrl = url.pathname === "/login" ? "/" : url.pathname + (url.search ? url.search : "");
      window.history.pushState({}, "", newUrl);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const active =
        urlParams.get("view") === "login" ||
        urlParams.get("login") === "1" ||
        window.location.pathname === "/login";
      setIsLoginActive(active);
    };

    const handleOpenEvent = () => openLogin();

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("open-client-login", handleOpenEvent);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("open-client-login", handleOpenEvent);
    };
  }, []);

  return (
    <LoginViewContext.Provider
      value={{
        isLoginActive,
        openLogin,
        closeLogin,
      }}
    >
      {children}
    </LoginViewContext.Provider>
  );
}

export function useLoginView() {
  const context = useContext(LoginViewContext);
  if (!context) {
    throw new Error("useLoginView must be used within a LoginViewProvider");
  }
  return context;
}
