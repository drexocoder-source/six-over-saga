import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <Card className="p-12 text-center gradient-card border-border/60 max-w-2xl mx-auto animate-fade-in">
      <Construction className="w-12 h-12 mx-auto text-primary mb-4" />
      <div className="font-display text-3xl tracking-wider mb-2">{title}</div>
      <p className="text-muted-foreground text-sm">
        {note ?? "Coming in the next phase. Finish the auction first — the Live Match engine, Schedule, Records, Stats and Chairman's Corner are being built next."}
      </p>
    </Card>
  );
}
