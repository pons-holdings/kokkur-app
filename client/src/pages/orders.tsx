import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/header";
import { BuyerOrdersList } from "@/components/buyer-orders-list";
import { useBuyerStore } from "@/lib/buyer-store";

export default function OrdersPage() {
  const { profileId } = useBuyerStore();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-2xl font-bold mb-6">My Orders</h1>

        <BuyerOrdersList buyerProfileId={profileId} />
      </div>
    </div>
  );
}
