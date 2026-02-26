import sys
from pathlib import Path

# Simulate being in the project root
sys.path.append(str(Path.cwd()))

try:
    # This simulates how main.py is run by PyInstaller if it's the entry point
    from ragkit.desktop import main
    print("Import successful")
except Exception as e:
    print(f"Import failed: {e}")

try:
    # This is what main.py does
    import ragkit.desktop.settings_store as s
    print("Absolute import from outside works")
except Exception as e:
    print(f"Absolute import failed: {e}")
