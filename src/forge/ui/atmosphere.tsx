// The «carbón místico» atmosphere of Engineering Forge (design §14.1, D4): five own layers painted BEHIND the content
// with pointer-events: none and no remote file. The mystique comes from atmosphere, never from colour: every value
// here is white or black at some opacity. Motion (fog drift, moon breathing) freezes under prefers-reduced-motion
// through ForgeWorld's data-motion="off".

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>\")";

export function ForgeAtmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden" data-forge-atmosphere="">
      {/* vignette base: void with abyss at the edge */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(140% 100% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.65)), #0a0a0b" }}
      />
      {/* moonlight: diffuse white-silver glow from the top right, plus a diagonal beam */}
      <div
        className="forge-moon absolute inset-0"
        style={{
          background:
            "radial-gradient(110% 80% at 100% 0%, rgba(255, 255, 255, 0.10), transparent 58%), linear-gradient(225deg, rgba(255, 255, 255, 0.05), transparent 42%)",
        }}
      />
      {/* fog: two slow layers */}
      <div
        className="forge-fog-a absolute -inset-[10%]"
        style={{ background: "radial-gradient(50% 40% at 30% 60%, rgba(255, 255, 255, 0.03), transparent 70%)" }}
      />
      <div
        className="forge-fog-b absolute -inset-[10%]"
        style={{ background: "radial-gradient(45% 35% at 70% 30%, rgba(255, 255, 255, 0.045), transparent 70%)" }}
      />
      {/* hairline reticle, both axes */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 24px)",
        }}
      />
      {/* fine grain, no animation */}
      <div className="absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px", opacity: 0.05 }} />
    </div>
  );
}
