import { ArcanumProvider } from "@/app/providers";
import { AccessGate } from "@/ui/AccessGate";
import { HomeView } from "@/ui/HomeView";

export default function Page() {
  return (
    <AccessGate>
      <ArcanumProvider>
        <HomeView />
      </ArcanumProvider>
    </AccessGate>
  );
}
