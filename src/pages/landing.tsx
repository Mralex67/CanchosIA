import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useListOpenaiSuggestedPrompts,
  useCreateOpenaiConversation,
} from "@/lib/api";
import {
  Loader2,
  MessageSquarePlus,
  Sparkles,
  ChevronRight,
  ImageIcon,
  GraduationCap,
  Brain,
  Zap,
  LogIn,
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const logoUrl = "/cochis_logo.png";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: prompts, isLoading: isLoadingPrompts } =
    useListOpenaiSuggestedPrompts();
  const createMutation = useCreateOpenaiConversation();
  const [isCreating, setIsCreating] = useState(false);

  const handleStart = async (title: string = "Nueva conversación") => {
    if (!user) {
      setLocation("/login");
      return;
    }
    try {
      setIsCreating(true);
      const conversation = await createMutation.mutateAsync({
        data: { title },
      });
      setLocation(`/chat/${conversation.id}`);
    } catch {
      toast({
        title: "Error al crear la conversación",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const features = [
    {
      icon: Brain,
      title: "Conoce de todo",
      desc: "Cultura, ciencia, código, viajes y más.",
    },
    {
      icon: ImageIcon,
      title: "Genera imágenes",
      desc: "Sin límite. Solo escribe /imagen.",
    },
    {
      icon: Zap,
      title: "Respuestas en vivo",
      desc: "Streaming en tiempo real, sin esperas.",
    },
    {
      icon: GraduationCap,
      title: "Tu cuenta, tus chats",
      desc: "Inicia sesión desde cualquier dispositivo.",
    },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/20">
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Cochis IA"
            className="w-10 h-10 object-cover shadow-sm rounded-lg"
          />
          <span className="font-display font-bold text-xl text-primary tracking-tight">
            Cochis IA
          </span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Button
              variant="outline"
              className="rounded-full font-medium"
              onClick={() => setLocation("/chat")}
            >
              Ir al Chat <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className="rounded-full font-medium"
                onClick={() => setLocation("/login")}
              >
                <LogIn className="w-4 h-4 mr-1" /> Entrar
              </Button>
              <Button
                className="rounded-full font-medium shadow-sm"
                onClick={() => setLocation("/registro")}
              >
                Crear cuenta
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center pt-32 pb-20 px-4 md:px-8 max-w-6xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6 shadow-sm border border-primary/20">
            <Sparkles className="w-4 h-4" />
            <span>El perro graduado que sabe de todo</span>
          </div>
          <div className="flex justify-center mb-6">
            <img
              src={logoUrl}
              alt="Cochis IA"
              className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-3xl shadow-xl border border-border"
            />
          </div>
          <h1 className="text-5xl md:text-7xl font-black font-display tracking-tight mb-6 text-foreground">
            Conversa con{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-600 to-secondary">
              Cochis IA
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto font-sans font-light">
            Tu asistente con birrete. Pregúntale lo que sea, pídele ideas o
            generale imágenes con{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-base">
              /imagen
            </code>
            .
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="rounded-full px-8 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleStart()}
              disabled={isCreating}
            >
              {isCreating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <MessageSquarePlus className="w-5 h-5 mr-2" />
              )}
              {user ? "Comenzar conversación" : "Empezar gratis"}
            </Button>
            {!user && (
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 py-6 text-lg font-medium"
                onClick={() => setLocation("/login")}
              >
                Ya tengo cuenta
              </Button>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl mb-16"
        >
          {features.map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-2xl border border-border bg-card text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <f.icon className="w-5 h-5" />
              </div>
              <div className="font-display font-semibold text-sm">
                {f.title}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {f.desc}
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px bg-border flex-1" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Ideas para empezar
            </h2>
            <div className="h-px bg-border flex-1" />
          </div>

          {isLoadingPrompts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card
                  key={i}
                  className="animate-pulse bg-muted/50 border-border/50 h-32 rounded-2xl"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prompts?.map((prompt) => (
                <Card
                  key={prompt.id}
                  className="group cursor-pointer border-border hover:border-primary/50 transition-all hover:shadow-md hover:-translate-y-1 bg-card rounded-2xl overflow-hidden"
                  onClick={() => handleStart(prompt.title)}
                >
                  <CardHeader className="pb-3 flex flex-row items-center gap-3 space-y-0">
                    <div className="p-2 bg-muted/50 rounded-lg group-hover:bg-primary/10 transition-colors">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase text-muted-foreground group-hover:text-primary transition-colors">
                        {prompt.category}
                      </span>
                      <CardTitle className="text-base font-display">
                        {prompt.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {prompt.prompt}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border mt-auto">
        <p>Cochis IA — el perro graduado de la inteligencia artificial 🎓</p>
      </footer>
    </div>
  );
}
