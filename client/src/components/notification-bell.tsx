import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  recipientType: string;
  recipientId: number;
  type: string;
  title: string;
  message: string;
  orderId: number | null;
  isRead: number;
  createdAt: string;
}

interface NotificationBellProps {
  recipientType: "chef" | "buyer";
  recipientId: number | null | undefined;
}

export function NotificationBell({ recipientType, recipientId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: [`/api/notifications/${recipientType}/${recipientId}/unread-count`],
    enabled: !!recipientId,
    refetchInterval: 30000,
  });

  const { data: notifs } = useQuery<Notification[]>({
    queryKey: [`/api/notifications/${recipientType}/${recipientId}`],
    enabled: !!recipientId && open,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/${recipientType}/${recipientId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/${recipientType}/${recipientId}/unread-count`] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/notifications/${recipientType}/${recipientId}/mark-all-read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/${recipientType}/${recipientId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/${recipientType}/${recipientId}/unread-count`] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  if (!recipientId) return null;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-[320px]">
          {!notifs || notifs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div>
              {notifs.map((notif) => (
                <button
                  key={notif.id}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-0",
                    notif.isRead === 0 && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (notif.isRead === 0) {
                      markReadMutation.mutate(notif.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    {notif.isRead === 0 && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                    <div className={cn("flex-1 min-w-0", notif.isRead === 1 && "ml-4")}>
                      <p className="text-sm font-medium leading-tight">{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatTime(notif.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
