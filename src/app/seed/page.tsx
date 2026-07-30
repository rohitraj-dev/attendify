"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { seedTestData } from "@/lib/seed-test-data";

export default function SeedPage() {
  const [isSeeding, setIsSeeding] = useState(false);

  async function handleSeed() {
    setIsSeeding(true);

    try {
      const result = await seedTestData();

      if (result.success) {
        alert("Test data seeded successfully");
        return;
      }

      alert(result.error);
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Seed Test Data</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={() => void handleSeed()}
              disabled={isSeeding}
              className="w-full sm:w-auto"
            >
              {isSeeding ? "Seeding..." : "Seed Test Data"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
