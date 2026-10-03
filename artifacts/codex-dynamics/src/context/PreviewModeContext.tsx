/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from "react";
import type { PreviewPage } from "@/lib/theme-engine";

interface PreviewModeValue {
  isPreview: boolean;
  currentPage: PreviewPage;
  navigateTo?: (page: PreviewPage) => void;
}

const PreviewModeContext = createContext<PreviewModeValue>({
  isPreview: false,
  currentPage: "home",
});

export function PreviewModeProvider({
  isPreview = false,
  currentPage = "home",
  navigateTo,
  children,
}: {
  isPreview?: boolean;
  currentPage?: PreviewPage;
  navigateTo?: (page: PreviewPage) => void;
  children: React.ReactNode;
}) {
  return (
    <PreviewModeContext.Provider value={{ isPreview, currentPage, navigateTo }}>
      {children}
    </PreviewModeContext.Provider>
  );
}

export function usePreviewMode() {
  return useContext(PreviewModeContext);
}
