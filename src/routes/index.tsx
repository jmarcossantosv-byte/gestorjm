import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Tv } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel IPTV — Gestão de clientes" },
      { name: "description", content: "Gerencie seus clientes de IPTV: vencimentos, planos e status." },
      { property: "og:title", content: "Painel IPTV — Gestão de clientes" },
      { property: "og:description", content: "Gerencie seus clientes de IPTV: vencimentos, planos e status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/painel" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="bg-brand flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl text-primary-foreground">
        <Tv className="h-7 w-7" />
      </div>
    </div>
  );
}
