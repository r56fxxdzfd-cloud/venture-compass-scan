import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPinOff } from "lucide-react";
import { motion } from "framer-motion";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        className="text-center space-y-6 p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
            <MapPinOff className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>
        <div>
          <h1 className="text-5xl font-bold tracking-tight">404</h1>
          <p className="mt-2 text-lg text-muted-foreground">Página não encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            O endereço <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code> não existe.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Dashboard
          </Link>
        </Button>
      </motion.div>
    </div>
  );
};

export default NotFound;
