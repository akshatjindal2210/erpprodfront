"use client";

import { useEffect } from "react";

export default function PwaOrientationLock() {
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        if (
          window.matchMedia("(display-mode: standalone)").matches &&
          screen.orientation?.lock
        ) {
          await screen.orientation.lock("portrait");
          console.log("Orientation locked");
        }
      } catch (err) {
        console.warn("Orientation lock failed:", err);
      }
    };

    lockOrientation();
  }, []);

  return null;
}