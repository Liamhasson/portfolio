import { MC_ASSETS } from "@/lib/marni-came/assets";

/** Board CS 09: the crowd's proof sits beside the challenges, with the Lido fan photo. */
export function MarniCameChallengeExtras() {
  return null;
}

export function MarniCameCrowd() {
  return (
    <figure className="mc-ph mc-crowd">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MC_ASSETS.fanPhoto} alt="A fan headbanging at the Lido show" loading="lazy" />
      <figcaption className="label">Lido · photo BIMM Institute Berlin</figcaption>
    </figure>
  );
}
