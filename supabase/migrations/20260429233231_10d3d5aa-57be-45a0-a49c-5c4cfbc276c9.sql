DROP TRIGGER IF EXISTS trg_sync_council_action_completed_at ON public.council_actions;

CREATE TRIGGER trg_sync_council_action_completed_at
BEFORE INSERT OR UPDATE ON public.council_actions
FOR EACH ROW
EXECUTE FUNCTION public.sync_council_action_completed_at();