# Wisk (Papillon) — mod de RimWorld 1.6

Cachorro Papillon preto e branco como animal domesticável, com comportamento próprio.

## Comportamento
- **Segue o favorito:** quando ocioso, o Wisk segue por ~1,5–3h de jogo o pawn favorito (vínculo → dono → colono mais próximo), só se os dois estiverem na **home area**. Não segue se estiver com fome/cansado, e depois descansa um cooldown.
- **Recreação:** colonos podem escolher "brincar com o Wisk" quando buscam lazer (tipo de lazer próprio, com tolerância). Dá o pensamento +3 de humor por ~0,6 dia.
- **Zoomies:** de vez em quando (e com 35% de chance depois de brincarem com ele) sai correndo em sprint pela home area por 15–30 s, soltando poeira. Colonos que veem ganham +2 de humor. Só acontece descansado, alimentado e sem inimigos por perto.
- **Isca ágil, não tanque:** vida base x1,0 e nenhum golpe sozinho causa mais de 8 de dano ("de raspão"), o bastante pra aguentar um acerto e fugir, mas dois ou três derrubam. A defesa dele é a agilidade: 90% de esquiva em corpo a corpo e nos tiros. Quando um ataque passa, ele foge e descansa (veja abaixo).
- **Arco de combate:** ameaça a <30 células → *zoomies evasivos* (ziguezague em volta do inimigo mais próximo, sem chegar a <5 células, preferindo a home area) → levou um golpe → "CHEGA DE GUERRA!" → corre pra **cama do dono** (ou do vínculo), depois cama dele, depois lugar seguro → descansa se estiver ferido.
- **Provocar (botão):** selecione o **Wisk** → botão **"Provocar..."** → clique no pawn **inimigo**. Ele corre em ziguezague em volta do inimigo (4+ células de distância) por até 1 min. O inimigo passa a **preferir o Wisk como alvo**, mas é só uma preferência (`tauntPreference` = 0,5: a cada reavaliação de alvo, 50% de chance de escolher o Wisk; se não achou ninguém, ele é o alvo). Patch Harmony em `AttackTargetFinder.BestAttackTarget`. Termina se o Wisk levar dano (aí ele foge), se o inimigo cair, ou com "Parar provocação".
- **Difícil de acertar:** corpo a corpo via stat `MeleeDodgeChance` = 0,9; tiros: 90% são absorvidos (aparece "errou!"). Explosões e fogo não são esquivados.
- **Foge ao tomar dano:** qualquer dano que passar faz ele correr (sprint) para a cama do dono/vínculo → cama dele (se estiver a ≥5 células de inimigos) → célula segura da home area (longe de inimigos e de preferência coberta). Fica escondido até 15 s sem dano e sem inimigo a <20 células, e se estiver ferido fica deitado descansando (até ~3 h de jogo) — enquanto ferido, não faz zoomies nem segue ninguém.
- **Matar o Wisk é imperdoável:** quando ele morre, todos os colonos ficam -20 de humor por 20 dias. Se alguém o matou de propósito, esse alguém vira alvo de -100 de opinião de todos os colonos, e o assassino ganha -25 de humor. Se foi o jogador, todas as facções não hostis perdem 40 de relação; se foi um aliado/neutro, a relação dele com o jogador cai 80. (Tiro de colono é tratado como bala perdida, não "de propósito".)
- **Não carrega coisas:** `trainability` Intermediate (sem treinar Haul) e `packAnimal` falso.
- Ajustes (chance, duração, cooldown) em `Comps` do `Papillon` via `CompProperties_Wisk`.

## Requisitos
Harmony (`brrainz.harmony`), carregado antes deste mod.

## Instalar
Copie a pasta `MeuPapillon/` para `RimWorld/Mods/` (ou `~/.config/unity3d/Ludeon Studios/RimWorld by Ludeon Studios/Mods` no Linux) e ative em **Mods**.

## Como conseguir
- Mercadores de animais (tags `AnimalCommon`/`AnimalPet`).
- Modo desenvolvedor: *Spawn pawn* → `Papillon`.

## Texturas
O RimWorld usa 3 direções (`_south`, `_east`, `_north`; o oeste é o leste espelhado) e 1 frame por direção, então a sheet de 8 direções × 6 frames de caminhada foi reduzida a essas 3 poses. Para regerar/trocar o frame: `python3 tools/extract_sprites.py` (requer pillow, numpy; ajuste `FRAME`).

Ajuste de tamanho: `drawSize` em `Defs/Papillon.xml`. O código C# está em `Source/` (`dotnet build -c Release` gera `MeuPapillon/1.6/Assemblies/MeuPapillon.dll`, já commitado). Compila contra a API 1.6, mas não foi testado dentro do jogo (sem o RimWorld aqui) — se algum def reclamar no log, me manda.
