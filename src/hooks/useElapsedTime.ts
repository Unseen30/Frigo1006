
import { useState, useEffect } from "react";

export const useElapsedTime = (startTime: string | null) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const start = new Date(startTime);
    const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
    setElapsedTime(elapsed);

    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  return elapsedTime;
};
