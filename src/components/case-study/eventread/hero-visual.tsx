import Image from "next/image";
import "./eventread.css";

/** Board frame 01: the month view for Berlin, November 2026, in its tray. */
export function EventreadHeroVisual() {
  return (
    <div className="tray">
      <Image
        src="/case-studies/eventread/calendar-berlin-2026-11.jpg"
        alt="Eventread month view for Berlin, November 2026, with 18 November selected"
        width={2400}
        height={1500}
        sizes="(min-width: 1100px) 85vw, 185vw"
        priority
      />
    </div>
  );
}
