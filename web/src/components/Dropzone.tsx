"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dropzone({
  onFiles,
}: {
  onFiles: (files: { text: string; name: string }[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      if (files.length === 0) return;
      const read = await Promise.all(
        files.map(async (f) => ({ text: await f.text(), name: f.name }))
      );
      onFiles(read);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      className={cn(
        "card flex cursor-pointer flex-col items-center justify-center gap-3 border-dashed px-6 py-14 text-center transition-colors",
        dragging
          ? "border-primary bg-primary-pale"
          : "hover:border-primary hover:bg-primary-pale/40"
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-primary-pale text-ink-deep">
        <UploadCloud className="size-7" />
      </span>
      <div>
        <p className="text-lg font-bold">Drop one or more bank CSVs here</p>
        <p className="mt-1 text-sm text-body">
          or click to choose files — processed entirely in your browser
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}
