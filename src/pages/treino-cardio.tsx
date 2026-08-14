import { BackLink, Page, PageHeader } from "@/components/ui/page";
import { DateNav } from "@/components/date-nav";
import { CardioTab } from "@/components/treino/cardio-tab";

export function TreinoCardio() {
  return (
    <Page>
      <PageHeader eyebrow={<BackLink to="/treino">Treino</BackLink>} title="Cardio">
        <DateNav />
      </PageHeader>
      <CardioTab />
    </Page>
  );
}
