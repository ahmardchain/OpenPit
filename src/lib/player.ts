"use client";
import { useState } from "react";

const KEY = "openpit.name";

function read(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return ""; // storage blocked: the field just starts empty
  }
}

/** The paper player's name, remembered in this browser only. */
export function usePlayerName() {
  const [name, setName] = useState(read);
  const save = (v: string) => {
    setName(v);
    try {
      localStorage.setItem(KEY, v.trim());
    } catch {
      /* ignore */
    }
  };
  return [name, save] as const;
}

export const validName = (v: string) => /^[A-Za-z0-9_.-]{2,20}$/.test(v.trim()) && !/^0x[0-9a-fA-F]{4,}/.test(v.trim());
