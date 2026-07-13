// app/components/EmptyState.tsx
"use client";

import { XCircle } from "lucide-react";

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export default function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      {icon ?? <XCircle className="w-12 h-12 text-slate-400" />}
      <h2 className="text-xl font-semibold text-slate-600">{message}</h2>
    </div>
  );
}
