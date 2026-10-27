"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBoard, fetchCalendar } from "@/apps/production/modules/job-card-board/board";

/**
 * Load Job Card Board / Calendar data.
 * @param {"board"|"calendar"} view
 */
export function useJobCardBoard(view = "board") {
  const isBoard = view !== "calendar";
  const [machines, setMachines] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isBoard) {
        const data = await fetchBoard();
        setMachines(data.machines || []);
        setCards(data.cards || []);
      } else {
        const data = await fetchCalendar();
        setMachines(data.machines || []);
        setCards(data.cards || []);
      }
    } catch (e) {
      setError(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [isBoard]);

  useEffect(() => {
    load();
  }, [load]);

  return { machines, setMachines, cards, setCards, loading, error, load, isBoard };
}
