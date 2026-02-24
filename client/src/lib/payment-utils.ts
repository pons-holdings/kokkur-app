const paymentMethodLabels: Record<string, string> = {
  venmo: "Venmo",
  paypal: "PayPal",
  zelle: "Zelle",
  cashapp: "Cash App",
  cash: "Cash",
  other: "Other",
};

export function getPaymentMethodLabel(method: string): string {
  return paymentMethodLabels[method] || method.charAt(0).toUpperCase() + method.slice(1);
}
