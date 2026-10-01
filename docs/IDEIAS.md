# Ideias para depois

## Gerador de ciclo por pesos, confiança e blocos

Objetivo: calcular o tempo total de cada matéria e o número de blocos de X minutos a partir de dados estatísticos, em vez de montar o ciclo na mão.

**Entradas (por matéria, guardadas por ciclo — cada ciclo é um alvo/concurso diferente):**
- **Peso/incidência:** percentual de questões da matéria em provas anteriores (estatísticas do TEC Concursos, digitadas ou coladas, ex.: `Direito Administrativo 12,5%`).
- **Seu desempenho:** percentual de acertos da própria pessoa por matéria (também a partir das estatísticas do TEC), atualizado de vez em quando. Não é preenchido durante o estudo.
- Alternativa/complemento: grau de confiança de 1 a 5.
- **Parâmetros do ciclo:** horas totais por volta e tamanho do bloco (padrão 40 min).

**Cálculo (rascunho):**
1. Peso final = incidência × fator de desempenho (quanto pior o acerto/confiança, maior o fator; ex.: de ×1,5 a ×0,5).
2. Distribuir o tempo total proporcionalmente aos pesos e arredondar para blocos inteiros (maiores restos), sem perder nem sobrar minutos; mínimo de 1 bloco para matérias com incidência.
3. Espalhar os blocos pelo ciclo com o embaralhar existente (`src/core/shuffle.ts`): repetições da mesma matéria distantes e sem classificações iguais seguidas.

**Tela:** tabela de matérias com incidência e desempenho, prévia (horas, blocos e ciclo resultante) e botão "Gerar ciclo" que substitui as etapas (avisando que começa uma volta nova, já que o progresso é ligado às etapas).

**Pontos em aberto:** incidência por ciclo vs. global; escala/efeito do desempenho; horas por volta vs. por semana; colar tabela do TEC com casamento aproximado de nomes.

## Outras ideias levantadas

- Registro de questões (acertos/erros) por sessão e % de acerto por matéria — adiado para não pesar o cadastro durante o estudo.
- Revisão espaçada (1, 7 e 30 dias) com "para revisar hoje".
- Tópicos por matéria (checklist de edital) a partir de editais anteriores.
- Meta semanal e data-alvo da prova, com projeção de voltas.
- Importar ciclo por texto e backup/restauração em JSON.
