# Meu Papillon (mod de RimWorld)

Cachorro Papillon preto e branco como animal domesticável.

## Instalar
Copie a pasta `MeuPapillon/` para `RimWorld/Mods/` (ou `~/.config/unity3d/Ludeon Studios/RimWorld by Ludeon Studios/Mods` no Linux) e ative em **Mods**.

## Como conseguir
- Mercadores de animais (tags `AnimalCommon`/`AnimalPet`).
- Modo desenvolvedor: *Spawn pawn* → `Papillon`.

## Texturas
O RimWorld usa 3 direções (`_south`, `_east`, `_north`; o oeste é o leste espelhado) e 1 frame por direção, então a sheet de 8 direções × 6 frames de caminhada foi reduzida a essas 3 poses. Para regerar/trocar o frame: `python3 tools/extract_sprites.py` (requer pillow, numpy; ajuste `FRAME`).

Ajuste de tamanho: `drawSize` em `Defs/Papillon.xml`. Não testado dentro do jogo (sem o RimWorld aqui) — se algum def reclamar no log, me manda.
