"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Select } from "./ui/select";
import {
  ChefHat, Plus, ClipboardList, UtensilsCrossed, Package,
  Clock, AlertTriangle, Eye
} from "lucide-react";
import Link from "next/link";

type AllergenInfo = { id: number; name: string };

type MenuItemWithAllergens = {
  id: number;
  title: string;
  description: string | null;
  price: number;
  stockQuantity: number;
  unitType: string;
  allergens: AllergenInfo[];
};

type MenuWithItems = {
  id: number;
  title: string;
  orderCutoffDate: string;
  fulfillmentDate: string;
  status: string;
  items: MenuItemWithAllergens[];
};

type OrderWithItems = {
  id: number;
  buyerName: string;
  totalAmount: number;
  status: string;
  fulfillmentMethod: string;
  deliveryAddress: string | null;
  createdAt: string;
  items: { id: number; title: string; quantity: number; priceAtTime: number }[];
};

type PrepItem = { title: string; quantity: number };

type ChefProfile = {
  id: number;
  slug: string;
  serviceRadius: number;
  fulfillmentMethods: string;
};

export function DashboardClient({
  chefProfile,
  menus,
  pendingOrders,
  prepList,
  allAllergens,
}: {
  chefProfile: ChefProfile;
  menus: MenuWithItems[];
  pendingOrders: OrderWithItems[];
  prepList: PrepItem[];
  allAllergens: AllergenInfo[];
}) {
  const [activeTab, setActiveTab] = useState<"menus" | "orders" | "prep">("menus");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const router = useRouter();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <ChefHat className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Chef Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your menus and orders</p>
          </div>
        </div>
        <Link href={`/chef/${chefProfile.slug}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-4 w-4" />
            View Storefront
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {[
          { key: "menus" as const, label: "Menus", icon: UtensilsCrossed },
          { key: "orders" as const, label: `Orders (${pendingOrders.length})`, icon: Package },
          { key: "prep" as const, label: "Prep List", icon: ClipboardList },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-muted-foreground hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Menus Tab */}
      {activeTab === "menus" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddMenu(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Menu
            </Button>
          </div>

          {showAddMenu && (
            <AddMenuForm
              chefProfileId={chefProfile.id}
              onDone={() => {
                setShowAddMenu(false);
                router.refresh();
              }}
            />
          )}

          {menus.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <UtensilsCrossed className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium">No menus yet</h3>
                <p className="text-muted-foreground mt-1">Create your first menu to start selling.</p>
              </CardContent>
            </Card>
          ) : (
            menus.map((menu) => (
              <Card key={menu.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{menu.title}</CardTitle>
                        <Badge
                          variant={
                            menu.status === "ACTIVE"
                              ? "default"
                              : menu.status === "DRAFT"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {menu.status}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Cutoff: {new Date(menu.orderCutoffDate + "T00:00:00").toLocaleDateString()}
                        </span>
                        <span>
                          Fulfills: {new Date(menu.fulfillmentDate + "T00:00:00").toLocaleDateString()}
                        </span>
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        setSelectedMenuId(menu.id);
                        setShowAddItem(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {menu.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No items yet. Add your first item to this menu.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {menu.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-3">
                          <div>
                            <div className="font-medium text-sm">{item.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              ${item.price.toFixed(2)} / {item.unitType} — Stock: {item.stockQuantity}
                            </div>
                            {item.allergens.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {item.allergens.map((a) => (
                                  <Badge key={a.id} variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200">
                                    {a.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}

          {showAddItem && selectedMenuId && (
            <AddItemForm
              menuId={selectedMenuId}
              allAllergens={allAllergens}
              onDone={() => {
                setShowAddItem(false);
                setSelectedMenuId(null);
                router.refresh();
              }}
            />
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {pendingOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium">No pending orders</h3>
                <p className="text-muted-foreground mt-1">Orders will appear here when buyers place them.</p>
              </CardContent>
            </Card>
          ) : (
            pendingOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Order #{order.id}</CardTitle>
                      <CardDescription>
                        {order.buyerName} — {order.fulfillmentMethod}
                        {order.deliveryAddress && ` to ${order.deliveryAddress}`}
                      </CardDescription>
                    </div>
                    <Badge>{order.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between py-1.5 text-sm">
                        <span>{item.title} x{item.quantity}</span>
                        <span className="font-medium">${(item.priceAtTime * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-2 border-t mt-2 font-bold text-sm">
                    <span>Total</span>
                    <span className="text-emerald-600">${order.totalAmount.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Prep List Tab */}
      {activeTab === "prep" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              Prep List
            </CardTitle>
            <CardDescription>
              Aggregated totals for all pending orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {prepList.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No pending orders to prepare.
              </p>
            ) : (
              <div className="divide-y">
                {prepList.map((item) => (
                  <div key={item.title} className="flex items-center justify-between py-3">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-lg font-bold text-emerald-600">
                      x{item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddMenuForm({
  chefProfileId,
  onDone,
}: {
  chefProfileId: number;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [fulfillment, setFulfillment] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chefProfileId,
          title,
          orderCutoffDate: cutoff,
          fulfillmentDate: fulfillment,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      onDone();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create New Menu</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="menu-title">Menu Title</Label>
            <Input
              id="menu-title"
              placeholder="e.g. Week of March 3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cutoff">Order Cutoff Date</Label>
              <Input
                id="cutoff"
                type="date"
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fulfill">Fulfillment Date</Label>
              <Input
                id="fulfill"
                type="date"
                value={fulfillment}
                onChange={(e) => setFulfillment(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Menu"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AddItemForm({
  menuId,
  allAllergens,
  onDone,
}: {
  menuId: number;
  allAllergens: AllergenInfo[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [unitType, setUnitType] = useState("Per Meal");
  const [selectedAllergens, setSelectedAllergens] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleAllergen = (id: number) => {
    setSelectedAllergens((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuId,
          title,
          description,
          price: parseFloat(price),
          stockQuantity: parseInt(stock),
          unitType,
          allergenIds: selectedAllergens,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      onDone();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Menu Item</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="item-title">Item Title</Label>
            <Input
              id="item-title"
              placeholder="e.g. Truffle Pasta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-desc">Description</Label>
            <Textarea
              id="item-desc"
              placeholder="Describe the dish..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-price">Price ($)</Label>
              <Input
                id="item-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="19.99"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-stock">Stock Qty</Label>
              <Input
                id="item-stock"
                type="number"
                min="0"
                placeholder="20"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-unit">Unit Type</Label>
              <Select id="item-unit" value={unitType} onChange={(e) => setUnitType(e.target.value)}>
                <option value="Per Meal">Per Meal</option>
                <option value="Per Tray">Per Tray</option>
                <option value="Per Serving">Per Serving</option>
                <option value="Per Plate">Per Plate</option>
                <option value="Per Piece">Per Piece</option>
                <option value="Per Box">Per Box</option>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Allergens
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {allAllergens.map((allergen) => (
                <label key={allergen.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedAllergens.includes(allergen.id)}
                    onCheckedChange={() => toggleAllergen(allergen.id)}
                  />
                  <span className="text-sm">{allergen.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
