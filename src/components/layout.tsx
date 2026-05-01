import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarSeparator,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  useListOpenaiConversations,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from "@/lib/api";
import {
  Plus,
  MessageSquare,
  Trash2,
  Moon,
  Sun,
  MoreVertical,
  Loader2,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const logoUrl = "/cochis_logo.png";

function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { data: conversations, isLoading } = useListOpenaiConversations();
  const deleteMutation = useDeleteOpenaiConversation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({
        queryKey: getListOpenaiConversationsQueryKey(),
      });
      toast({ title: "Conversación eliminada" });
      if (location === `/chat/${id}`) setLocation("/chat");
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      queryClient.clear();
      setLocation("/login");
    } catch {
      toast({ title: "Error al cerrar sesión", variant: "destructive" });
    }
  };

  const initials = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : (user?.email.slice(0, 2).toUpperCase() ?? "??");

  return (
    <Sidebar>
      <SidebarHeader className="p-4 flex flex-row items-center gap-3">
        <img
          src={logoUrl}
          alt="Cochis IA"
          className="w-8 h-8 rounded-md object-cover shadow-sm"
        />
        <span className="font-display font-bold text-lg tracking-tight text-primary">
          Cochis IA
        </span>
      </SidebarHeader>

      <div className="px-4 pb-2">
        <Button
          onClick={() => setLocation("/chat")}
          className="w-full justify-start gap-2 shadow-sm"
          variant={location === "/chat" ? "secondary" : "default"}
        >
          <Plus className="w-4 h-4" />
          <span>Nueva conversación</span>
        </Button>
      </div>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Historial</SidebarGroupLabel>
          <SidebarGroupContent>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations?.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center">
                Aún no hay conversaciones
              </div>
            ) : (
              <SidebarMenu>
                {conversations?.map((conv) => (
                  <SidebarMenuItem key={conv.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === `/chat/${conv.id}`}
                      tooltip={conv.title}
                    >
                      <Link
                        href={`/chat/${conv.id}`}
                        className="flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span className="truncate">{conv.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction>
                          <MoreVertical className="w-4 h-4" />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <AlertDialog
                          open={deletingId === conv.id}
                          onOpenChange={(open) =>
                            !open && setDeletingId(null)
                          }
                        >
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setDeletingId(conv.id);
                              }}
                              className="text-destructive focus:text-destructive cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                ¿Eliminar conversación?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se
                                eliminarán permanentemente todos los mensajes.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(conv.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/50 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
          <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-auto py-2"
            >
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="flex flex-col items-start text-left min-w-0 flex-1">
                <span className="text-sm font-medium truncate w-full">
                  {user?.displayName || user?.email}
                </span>
                {user?.displayName && (
                  <span className="text-xs text-muted-foreground truncate w-full">
                    {user.email}
                  </span>
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center px-4 border-b border-border/50 lg:hidden">
            <SidebarTrigger />
            <div className="flex-1 flex justify-center">
              <span className="font-display font-bold text-primary">
                Cochis IA
              </span>
            </div>
          </header>
          <div className="flex-1 overflow-hidden relative">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
