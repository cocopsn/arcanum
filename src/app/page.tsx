import { ArcanumProvider } from "@/app/providers";
import { HomeView } from "@/ui/HomeView";

export default function Page() {
  return (
    <ArcanumProvider>
      <HomeView />
    </ArcanumProvider>
  );
}
