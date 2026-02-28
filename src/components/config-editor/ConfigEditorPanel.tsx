import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfigAutoSave } from '@/hooks/useConfigAutoSave';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { DimensionsQuestionsTab } from './DimensionsQuestionsTab';
import { WeightsTargetsTab } from './WeightsTargetsTab';
import { RedFlagsTab } from './RedFlagsTab';
import type { ConfigJSON } from '@/types/darwin';

interface Props {
  draftId: string;
  initialConfig: ConfigJSON;
  onConfigUpdated?: (config: ConfigJSON) => void;
}

export function ConfigEditorPanel({ draftId, initialConfig, onConfigUpdated }: Props) {
  const [config, setConfig] = useState<ConfigJSON>(JSON.parse(JSON.stringify(initialConfig)));

  const handleSaved = useCallback((savedJson: ConfigJSON) => {
    setConfig(JSON.parse(JSON.stringify(savedJson)));
    onConfigUpdated?.(savedJson);
  }, [onConfigUpdated]);

  const { status, scheduleSave } = useConfigAutoSave(draftId, handleSaved);

  const handleChange = useCallback((newConfig: ConfigJSON) => {
    setConfig(newConfig);
    scheduleSave(newConfig);
  }, [scheduleSave]);

  return (
    <div className="border-t bg-muted/20 p-4 space-y-3" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Editor Visual</p>
        <SaveStatusIndicator status={status} />
      </div>

      <Tabs defaultValue="dimensions">
        <TabsList className="h-8">
          <TabsTrigger value="dimensions" className="text-xs">Dimensões & Perguntas</TabsTrigger>
          <TabsTrigger value="weights" className="text-xs">Pesos & Targets</TabsTrigger>
          <TabsTrigger value="redflags" className="text-xs">Red Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="dimensions" className="mt-3">
          <DimensionsQuestionsTab config={config} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="weights" className="mt-3">
          <WeightsTargetsTab config={config} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="redflags" className="mt-3">
          <RedFlagsTab config={config} onChange={handleChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
