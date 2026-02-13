# ragkit-backend.spec
a = Analysis(
    ['ragkit/desktop/main.py'],
    pathex=['.'],
    datas=[],
    hiddenimports=['uvicorn.logging', 'uvicorn.protocols.http'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, a.binaries, a.datas,
    name='ragkit-backend',
    console=True,
    strip=False,
    upx=True,
)
