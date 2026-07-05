import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStartupsTool from "./tools/list-startups";
import getStartupTool from "./tools/get-startup";
import listAssessmentsTool from "./tools/list-assessments";
import listActionItemsTool from "./tools/list-action-items";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "darwin-growth-mcp",
  title: "Darwin Growth MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas para acessar startups, diagnósticos e planos de ação da plataforma Darwin Growth. Use list_startups para descobrir empresas, get_startup para detalhes, list_assessments para diagnósticos e list_action_items para o plano de ação.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listStartupsTool, getStartupTool, listAssessmentsTool, listActionItemsTool],
});
