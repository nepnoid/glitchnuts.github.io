#!/usr/bin/env python3
"""Deprecated starter generator for the GNC Collaboration Hub.

The package files are now the source of truth. This script previously regenerated an older
Gemini-Manus-only starter and could overwrite the current Kdawg → Gemini → Meli → Manus → GNC
shared-state package with stale environment variable names.

Do not use this script to rebuild the package. Edit the package files directly and rebuild the
archive from the repository root instead:

    cd /home/ubuntu
    zip -r gnc_trio_hub_meli_v1.zip gnc_trio_hub \
      -x "gnc_trio_hub/node_modules/*" "gnc_trio_hub/.env" "gnc_trio_hub/.git/*"
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent

print(
    "create_starter_files.py is deprecated. "
    f"Current package files under {ROOT} are the source of truth; no files were changed."
)
