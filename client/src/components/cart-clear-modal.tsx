import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";

interface CartClearModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newChefName: string;
  onConfirm: () => void;
}

export function CartClearModal({
  open,
  onOpenChange,
  newChefName,
  onConfirm,
}: CartClearModalProps) {
  const { chef, clearCart, getItemCount } = useCartStore();
  const itemCount = getItemCount();

  const handleConfirm = () => {
    clearCart();
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <AlertDialogTitle className="text-center">
            Start a New Order?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-2">
            <p>
              You have {itemCount} {itemCount === 1 ? "item" : "items"} from{" "}
              <span className="font-medium text-foreground">{chef?.name}</span> in your
              cart.
            </p>
            <p>
              Adding items from{" "}
              <span className="font-medium text-foreground">{newChefName}</span> will
              clear your current cart.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-col sm:space-x-0 gap-2">
          <AlertDialogAction
            onClick={handleConfirm}
            className="w-full"
            data-testid="button-confirm-clear"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Start New Order
          </AlertDialogAction>
          <AlertDialogCancel className="w-full" data-testid="button-cancel-clear">
            Keep Current Cart
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
