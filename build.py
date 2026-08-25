import shutil
import os

plugin_dir = os.path.dirname(os.path.abspath(__file__))
out_base = os.path.join(plugin_dir, "zotero-md-annotations-release_v0.1")
out_zip = out_base + ".zip"
out_xpi = out_base + ".xpi"

if os.path.exists(out_xpi):
    os.remove(out_xpi)

shutil.make_archive(out_base, 'zip', plugin_dir)
os.rename(out_zip, out_xpi)
print(f"Successfully built {out_xpi} using shutil")
