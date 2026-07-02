export function friendlySupabaseError(message?: string | null): string {
  const raw = message || '';
  const normalized = raw.toLowerCase();

  if (normalized.includes('row-level security') || normalized.includes('rls')) {
    return 'Você não tem permissão para executar esta ação neste modo ou nesta organização. No modo demo, use os dados disponíveis e ações liberadas.';
  }

  if (normalized.includes('permission denied') || normalized.includes('not authorized')) {
    return 'Seu perfil não tem permissão para executar esta ação.';
  }

  return raw || 'Não foi possível concluir a ação agora.';
}
