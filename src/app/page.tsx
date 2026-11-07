import { ArcanumProvider } from "@/app/providers";
import { AccessGate } from "@/ui/AccessGate";
import { AppUpdate } from "@/ui/AppUpdate";
import { HomeView } from "@/ui/HomeView";
import { CompanionMount } from "@/ui/companion/CompanionMount";

export default function Page() {
  return (
    <>
      <AccessGate>
        <ArcanumProvider>
          <HomeView />
          <CompanionMount />
        </ArcanumProvider>
      </AccessGate>
      {/* outside AccessGate: an update or a chunk that did not load is said also on the lock screen (poblar §6.9) */}
      <AppUpdate />
    </>
  );
}
