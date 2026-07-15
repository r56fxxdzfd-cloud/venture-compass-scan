import type { StartupPipelineStatus } from '@/types/darwin';

// Fonte única dos rótulos do pipeline — usada no detalhe da startup (seletor de
// status) e na lista do portfólio (badge + filtro).
export const pipelineStatusLabels: Record<StartupPipelineStatus, string> = {
  invited: 'Convidada',
  registration_started: 'Cadastro iniciado',
  registration_completed: 'Cadastro concluído',
  diagnosis_started: 'Diagnóstico iniciado',
  diagnosis_completed: 'Diagnóstico concluído',
  debrief_scheduled: 'Devolutiva agendada',
  debrief_completed: 'Devolutiva realizada',
  selected_for_pilot: 'Selecionada para piloto',
  standby: 'Standby',
  in_followup: 'Em follow-up',
};

export const pipelineStatusOptions = Object.entries(pipelineStatusLabels) as [StartupPipelineStatus, string][];
export const pipelineStatusOrder = pipelineStatusOptions.map(([value]) => value);
