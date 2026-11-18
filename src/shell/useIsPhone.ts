import { useEffect, useState } from "react";

export const PHONE_BREAKPOINT = 1024;

export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < PHONE_BREAKPOINT : false,
  );

  useEffect(() => {
    const update = () => setIsPhone(window.innerWidth < PHONE_BREAKPOINT);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isPhone;
}
