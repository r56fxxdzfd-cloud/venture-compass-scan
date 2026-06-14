# Vídeo 45s — White-label "OS de Conselhos" (Darwin Growth como case)

Vídeo de 45s (1920×1080, 30fps = 1350 frames), Glass Aurora, pitch B2B para empresas que oferecem conselho/board/mentoria e querem uma plataforma própria. Darwin Growth aparece como **case real** (vertical startups), não como produto sendo vendido. Voice George (PT-BR), trilha contínua sem cortes.

## Posicionamento

- Vendedor: plataforma white-label "Sistema Operacional de Conselhos".
- Prova: "veja o Darwin Growth — implementação real para conselhos de startups".
- Promessa dupla:
  1. **Tangibilizar a oferta** ao lead (diagnóstico → relatório → pauta).
  2. **Organizar o conselheiro** (portfólio, agenda, acompanhamento, retenção).
- Sem mencionar "Darwin" como marca do vendedor — Darwin entra rotulado como "Case: vertical Startups".

## Roteiro (10 cenas, ~45s)

| # | Dur (frames) | Cena | Voice-over PT-BR |
|---|--------------|------|------------------|
| 1 | 3s (90) | Tipografia: "Sistema Operacional de Conselhos" | "Existe uma forma de transformar a sua oferta de conselho em um produto tangível." |
| 2 | 4s (120) | Hook: "Como o seu conselho prova valor antes da venda?" | "Como o seu conselho prova valor antes mesmo de fechar o contrato?" |
| 3 | 4s (120) | Card "Case real · Vertical Startups" + screenshot dashboard | "Este é um case real: uma plataforma de conselhos para startups, construída sobre o nosso OS." |
| 4 | 5s (150) | report-1.png — KPIs + narrativa | "Em minutos, o lead recebe um diagnóstico executivo com score, confiança e narrativa." |
| 5 | 4s (120) | report-radar.png — 9 dimensões | "Nove dimensões, comparadas a benchmark e potencial." |
| 6 | 5s (150) | Split: report-redflags + report-matrix | "Red flags e matriz risco × impacto mostram onde o conselho precisa agir primeiro." |
| 7 | 4s (120) | report-pauta.png — quick wins / pauta / roadmap | "E já entregam a pauta da próxima reunião — quick wins e roadmap." |
| 8 | 5s (150) | counselor-center + counselor-overview (split) | "Para os conselheiros: portfólio inteiro em uma tela. Agenda, foco e prioridades." |
| 9 | 4s (120) | meeting-detail + meeting-actions | "Cada reunião com pauta, decisões e ações acompanhadas — retenção maior, churn menor." |
| 10 | 7s (210) | CTA tipográfico | "Esta plataforma pode ser o Sistema Operacional do seu conselho — white-label, no seu posicionamento." |

CTA visual cena 10 (3 linhas stagger):
- "Seu Sistema Operacional de Conselhos"
- "White-label · sua marca · seu método"
- "Tangibilize a venda. Organize o conselho. Retenha mais clientes."

Rótulos on-screen das cenas 3-9: badge discreto "Case: vertical Startups" no canto, em vez do "Diagnóstico Darwin" usado no vídeo anterior. Logo Darwin **não** aparece no header dessas cenas.

## Áudio

- **VO** (`vo45.mp3`): ElevenLabs `JBFqnCBsd6RMkjVDRZzb` (George), `eleven_multilingual_v2`, stability 0.5, similarity 0.8, style 0.3, speed 1.05. ~42-43s falados.
- **Trilha** (`music45.mp3`): ElevenLabs Music, prompt "modern cinematic uplifting corporate B2B SaaS, warm pads + subtle pulse, no vocals, continuous flow, 50s". Volume 0.16.
- Mix ffmpeg `amix` + `afade=t=out:st=43:d=2` na trilha. Sem cortes intermediários.

## Implementação técnica

1. `remotion/src/DemoVideoB2B.tsx` — novo arquivo, mantém `DemoVideo.tsx` anterior.
2. `remotion/src/Root.tsx` — adiciona composition `demo-b2b` (1350 frames).
3. Reusa `AuroraBg`, `Shot`, `Split`, `HookScene` de `DemoVideo.tsx`. Adapta:
   - `Chrome`: substitui logo Darwin por badge "Case · Vertical Startups" (cor purple suave) e remove o "Darwin" no canto.
   - Cena 1 e 10: tipografia pura (sem logo Darwin).
4. Cena 10 (`CTAScene`): 3 linhas Space Grotesk 700, stagger 12 frames, glow verde no termo "Sistema Operacional".
5. Áudio: dois `<Audio>` (music45 0.16, vo45 1.0).
6. Script render: `remotion/scripts/render-demo-b2b.mjs` → `/mnt/documents/darwin-demo-b2b-v1-muted.mp4` → mix ffmpeg → `darwin-os-conselhos-v1.mp4`.
7. Áudio via curl direto na API ElevenLabs (`xi-api-key` = `ELEVENLABS_API_KEY`, mesmo padrão do vo30b.mp3).

## Entregáveis

- `remotion/src/DemoVideoB2B.tsx`, edit `Root.tsx`
- `remotion/scripts/render-demo-b2b.mjs`
- `remotion/public/audio/vo45.mp3`, `music45.mp3`
- `/mnt/documents/darwin-os-conselhos-v1.mp4` (~45s, áudio contínuo)
- `<presentation-artifact>` para download

## Pré-requisitos

- Conector ElevenLabs já linkado.
- Imagens necessárias já existem em `remotion/public/images/`: dashboard, report-1, report-radar, report-redflags, report-matrix, report-pauta, counselor-center, counselor-overview, meeting-detail, meeting-actions.
