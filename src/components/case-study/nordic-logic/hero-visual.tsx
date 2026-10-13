import Image from "next/image";
import "./nordic-logic.css";

/** Board frame 01: the live home page in its tray, as Eventread's (recorded 2026-10-13 at 2×, after the 3D film lands). */
export function NordicLogicHeroVisual() {
  return (
    <div className="tray">
      <Image
        src="/case-studies/nordic-logic/hero.jpg"
        alt="Nordic Logic's home page: Your carriers owe you, above the client portal's overview"
        width={2400}
        height={1500}
        sizes="(min-width: 1100px) 85vw, 145vw"
        priority
      />
    </div>
  );
}
