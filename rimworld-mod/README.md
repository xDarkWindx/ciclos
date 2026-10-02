# Wisk (Papillon) — mod de RimWorld 1.6

Cachorro Papillon preto e branco como animal domesticável, com comportamento próprio.

## Comportamento
- **Segue o favorito:** quando ocioso, o Wisk segue por ~1,5–3h de jogo o pawn favorito (vínculo → dono → colono mais próximo), só se os dois estiverem na **home area**. Não segue se estiver com fome/cansado, e depois descansa um cooldown.
- **Recreação:** colonos podem escolher "brincar com o Wisk" quando buscam lazer (tipo de lazer próprio, com tolerância). Dá o pensamento +3 de humor por ~0,6 dia.
- Ajustes (chance, duração, cooldown) em `Comps` do `Papillon` via `CompProperties_Wisk`.

## Instalar
Copie a pasta `MeuPapillon/` para `RimWorld/Mods/` (ou `~/.config/unity3d/Ludeon Studios/RimWorld by Ludeon Studios/Mods` no Linux) e ative em **Mods**.

## Como conseguir
- Mercadores de animais (tags `AnimalCommon`/`AnimalPet`).
- Modo desenvolvedor: *Spawn pawn* → `Papillon`.

## Texturas
O RimWorld usa 3 direções (`_south`, `_east`, `_north`; o oeste é o leste espelhado) e 1 frame por direção, então a sheet de 8 direções × 6 frames de caminhada foi reduzida a essas 3 poses. Para regerar/trocar o frame: `python3 tools/extract_sprites.py` (requer pillow, numpy; ajuste `FRAME`).

Ajuste de tamanho: `drawSize` em `Defs/Papillon.xml`. O código C# está em `Source/` (`dotnet build -c Release` gera `MeuPapillon/1.6/Assemblies/MeuPapillon.dll`, já commitado). Compila contra a API 1.6, mas não foi testado dentro do jogo (sem o RimWorld aqui) — se algum def reclamar no log, me manda.
