import { useEffect, useState } from "react";

/** Current unix time in seconds, ticking every 250 ms. */
export const useNow = () => {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 250);
    return () => clearInterval(t);
  }, []);
  return now;
};
