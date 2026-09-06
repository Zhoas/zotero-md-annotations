import os
import zipfile

plugin_dir = os.path.dirname(os.path.abspath(__file__))
out_xpi = os.path.join(plugin_dir, "zotero-md-annotations-release_v0.1.3.xpi")

if os.path.exists(out_xpi):
    os.remove(out_xpi)

include_files = ["manifest.json", "bootstrap.js"]
include_dirs = ["lib"]

with zipfile.ZipFile(out_xpi, "w", zipfile.ZIP_DEFLATED) as zf:
    for f in include_files:
        p = os.path.join(plugin_dir, f)
        if os.path.exists(p):
            zf.write(p, arcname=f)
    for d in include_dirs:
        dir_path = os.path.join(plugin_dir, d)
        for root, _, files in os.walk(dir_path):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, plugin_dir)
                zf.write(full_path, arcname=rel_path)

print(f"Successfully built {out_xpi} ({os.path.getsize(out_xpi)} bytes)")
