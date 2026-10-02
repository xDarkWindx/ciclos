"""Recorta a sprite sheet (6 frames x 8 direções) nas texturas do RimWorld.

Linhas da sheet: 0=S 1=SE 2=E 3=NE 4=N 5=NW 6=W 7=SW.
O RimWorld só precisa de south/east/north (west é o east espelhado).
Uso: python3 extract_sprites.py  (requer pillow e numpy)
"""
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
OUT = HERE.parent / "MeuPapillon/Textures/Things/Pawn/Animal/Papillon"
CANVAS = 160
FRAME = 0  # frame (coluna) usado como pose parada
ROWS = {"south": 0, "east": 2, "north": 4}
COLS = [(182, 336), (385, 539), (586, 739), (787, 939), (979, 1139), (1187, 1347)]
ROW_Y = [(4, 140), (143, 258), (269, 376), (386, 506), (513, 635), (642, 762), (768, 878), (883, 1010)]

sheet = Image.open(HERE / "spritesheet.webp").convert("RGBA")
OUT.mkdir(parents=True, exist_ok=True)
for name, r in ROWS.items():
    x0, x1 = COLS[FRAME]; y0, y1 = ROW_Y[r]
    cell = sheet.crop((x0 - 4, y0, x1 + 5, y1 + 1))
    bbox = cell.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    cell = cell.crop(bbox)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    # centraliza horizontalmente, patas um pouco acima da base
    canvas.paste(cell, ((CANVAS - cell.width) // 2, CANVAS - cell.height - 12), cell)
    canvas.save(OUT / f"Papillon_{name}.png")
    print(name, cell.size)
