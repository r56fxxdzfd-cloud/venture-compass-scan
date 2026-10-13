-- Rebrand Darwin Growth -> Comitte: texto da pergunta de expectativas do
-- formulário inicial (os demais textos do produto vivem no frontend).
UPDATE public.onboarding_questions
SET question_text = 'O que você espera obter com a participação no Comitte?'
WHERE question_key = 'expectations_text'
  AND question_text ILIKE '%Darwin Growth%';
