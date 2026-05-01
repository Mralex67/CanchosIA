import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background text-foreground px-4">
      <div className="text-center max-w-md">
        <img
          src="/cochis_logo.png"
          alt="Cochis IA"
          className="w-20 h-20 mx-auto mb-6 rounded-2xl object-cover border border-border shadow-md"
        />
        <h1 className="text-4xl font-display font-bold mb-3 text-foreground">
          Página no encontrada
        </h1>
        <p className="text-muted-foreground mb-8">
          Hasta Cochis se perdió en esta ruta. Volvamos al inicio.
        </p>
        <Button onClick={() => setLocation("/")} className="rounded-full">
          Volver al inicio
        </Button>
      </div>
    </div>
  );
}
