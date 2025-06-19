"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useFileUpload } from "./spreadsheet/FileUploadContext";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { setFile } = useFileUpload();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      router.push("/spreadsheet");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-8">
      <h1 className="text-3xl font-bold mb-4">Upload COBie Data File</h1>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="mb-4 border p-2 rounded"
        onChange={handleFileChange}
      />
      <p className="text-gray-600">Select a COBie Excel file to view its contents as a spreadsheet.</p>
    </div>
  );
}
