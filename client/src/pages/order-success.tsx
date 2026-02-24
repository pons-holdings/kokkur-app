import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, UtensilsCrossed, ArrowRight, ClipboardList } from "lucide-react";
import { Header } from "@/components/header";

export default function OrderSuccess() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-12 pb-8 text-center space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Order Placed Successfully!</h1>
              <p className="text-muted-foreground">
                Thank you for your order. Your chefs have been notified and will start
                preparing your delicious meals.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>
                <strong>What happens next?</strong>
              </p>
              <p className="mt-2">
                Your chef has been notified and will confirm your order shortly.
                You can track your order status in real-time from the My Orders page.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link href="/orders">
                <Button data-testid="button-track-orders">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Track My Orders
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" data-testid="button-browse-more">
                  <UtensilsCrossed className="h-4 w-4 mr-2" />
                  Browse More Menus
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
