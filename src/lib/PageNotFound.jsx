import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function PageNotFound() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="text-sm text-zinc-400 mb-2">404</div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>

        <div className="text-sm text-zinc-400 mb-4">
          Path: <span className="font-mono text-zinc-200">{location.pathname}</span>
        </div>

        <p className="text-zinc-300 text-sm mb-6">
          このページは存在しません。URLが間違っているか、移動した可能性があります。
        </p>

        <div className="flex gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-600"
          >
            Go Home
          </Link>
          <a
            href="https://github.com/Worldmorse-project/Worldmorse.project"
            className="inline-flex items-center justify-center rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
