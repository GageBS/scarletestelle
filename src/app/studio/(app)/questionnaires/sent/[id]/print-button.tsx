"use client";
import { Button } from "@/components/studio/ui";

export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      Print
    </Button>
  );
}
