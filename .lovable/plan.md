# Vídeo Demo Darwin — 30s, Diagnóstico + Relatório

Vídeo de 30 segundos (1920x1080, 30fps = 900 frames), aesthetic **Dynamic SaaS** (cortes rápidos, springs energéticos, paleta Glass Aurora: navy #0a0f1f, verde #4ade80, roxo #a78bfa), com **narração PT-BR (ElevenLabs)** + **trilha de fundo (ElevenLabs Music)**.

## Storyboard (8 cenas)

| # | Dur | Cena | Narração PT-BR |
|---|-----|------|----------------|
| 1 | 3s | Logo Darwin + tagline "Diagnóstico que vira ação" | "Darwin. Diagnóstico que vira ação." |
| 2 | 3s | Hook: "Sua startup está pronta para escalar?" tipografia grande | "Sua startup está pronta para escalar?" |
| 3 | 4s | Screenshot dashboard + zoom no card de score | "Em minutos, descubra o nível de maturidade do seu negócio." |
| 4 | 4s | Screenshot relatório (report-1.png) com KPIs animando | "Score consolidado, nível de confiança e narrativa executiva." |
| 5 | 4s | Radar chart (report-radar.png) com highlight nas dimensões | "Nove dimensões avaliadas contra benchmark e potencial." |
| 6 | 4s | Red Flags (report-redflags.png) + Matriz (report-matrix.png) split | "Identifique riscos críticos e priorize onde agir primeiro." |
| 7 | 4s | Pauta sugerida (report-pauta.png) — Quick Wins / Roadmap | "Receba um plano acionável — quick wins, pauta e roadmap." |
| 8 | 4s | Logo + URL diagnosticostartups.com | "Darwin. Conselhos coletivos que aceleram o crescimento." |

## Áudio

- **Voiceover**: gerar via ElevenLabs TTS (voz PT-BR — `JBFqnCBsd6RMkjVDRZzb`/George ou similar com bom PT) usando o skill `ai-gateway` ou chamada direta. Salvar em `remotion/public/audio/vo.mp3`.
- **Trilha**: gerar via ElevenLabs Music — prompt "modern uplifting electronic SaaS background, subtle drive, no vocals, 30s". Salvar em `remotion/public/audio/music.mp3`.
- No Remotion: dois `<Audio>` no `MainVideo` — música em volume 0.25, voiceover em volume 1.0.
- Renderizar com `muted: false` (precisa instalar/usar build ffmpeg com aac) — alternativa: render vídeo mudo + `ffmpeg -i video.mp4 -i music.mp3 -i vo.mp3 -filter_complex amix` para mux final.

## Implementação técnica

1. Reutilizar projeto `remotion/` existente (já configurado).
2. Criar `remotion/src/DemoVideo.tsx` (novo, não substitui MainVideo) — 900 frames, 30fps.
3. Estrutura: `<TransitionSeries>` com 8 sequências, transições `fade`/`slide` curtas (10-15 frames).
4. Layers persistentes: gradient aurora animado no fundo (radial verde+roxo), partículas sutis.
5. Tipografia: Space Grotesk (700) + DM Sans (400) via `@remotion/google-fonts`.
6. Motion system:
   - Entrada padrão: spring `{damping:18, stiffness:140}` com fade+translateY 30px
   - Hero (cena 1, 8): scale 0.8→1 com damping 12
   - Highlights nos screenshots: caixa verde glow aparecendo após 12 frames
7. Adicionar composition `demo` no `Root.tsx` (mantém `main` antiga).
8. Script de render: `remotion/scripts/render-demo.mjs` — bundla, renderiza com puppeteer, output `/mnt/documents/darwin-demo-v2.mp4`.
9. Pós-processamento ffmpeg para mixar áudio:
   ```
   ffmpeg -y -i video.mp4 -i music.mp3 -i vo.mp3 \
     -filter_complex "[1:a]volume=0.22[m];[2:a]volume=1.0[v];[m][v]amix=inputs=2:duration=longest[a]" \
     -map 0:v -map "[a]" -c:v copy -c:a aac -shortest darwin-demo-v2.mp4
   ```

## Entregáveis

- `remotion/src/DemoVideo.tsx`, `remotion/src/Root.tsx` (adiciona composition)
- `remotion/scripts/render-demo.mjs`
- `remotion/public/audio/vo.mp3`, `music.mp3` (gerados via ElevenLabs)
- MP4 final em `/mnt/documents/darwin-demo-v2.mp4` (~30s, com som)
- Tag `<presentation-artifact>` para download

## Pré-requisito

Conector **ElevenLabs** precisa estar linkado ao projeto (para TTS PT-BR + Music). Verifico antes; se faltar, peço a conexão.
