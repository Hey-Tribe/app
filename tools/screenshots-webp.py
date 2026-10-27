# Converts the PNGs from tools/screenshots.mjs into the website's WebP files (full size and 520px "sm"), then removes the PNGs.
import glob, os
from PIL import Image
for d in ["assets/f", "assets/f/es"]:
    for png in sorted(glob.glob(f"{d}/*.png")):
        name = os.path.basename(png)[:-4]
        im = Image.open(png).convert("RGBA")
        im.save(f"{d}/{name}.webp", "WEBP", quality=84, method=6)
        sm = im.resize((520, round(im.height * 520 / im.width)), Image.LANCZOS)
        os.makedirs(f"{d}/sm", exist_ok=True)
        sm.save(f"{d}/sm/{name}.webp", "WEBP", quality=82, method=6)
        os.remove(png)
        print(f"{d}/{name}.webp")
