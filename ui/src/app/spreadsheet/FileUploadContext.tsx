"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface FileUploadContextType {
  file: File | null;
  setFile: (file: File | null) => void;
}

const FileUploadContext = createContext<FileUploadContextType | undefined>(undefined);

export const FileUploadProvider = ({ children }: { children: ReactNode }) => {
  const [file, setFile] = useState<File | null>(null);
  return (
    <FileUploadContext.Provider value={{ file, setFile }}>
      {children}
    </FileUploadContext.Provider>
  );
};

export const useFileUpload = () => {
  const context = useContext(FileUploadContext);
  if (!context) {
    throw new Error("useFileUpload must be used within a FileUploadProvider");
  }
  return context;
}; 