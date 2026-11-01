#!/usr/bin/env python3
"""Package only public, reproducible sources; never include local HA artifacts."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'package.json').read_text())['version']
output_dir = ROOT / 'release'
output_dir.mkdir(exist_ok=True)
output = output_dir / f'isp-box-card-{version}.zip'
if output.exists():
    raise SystemExit(f'Refusing to overwrite existing release: {output}')
files = [ROOT / name for name in (
    '.gitignore', 'package.json', 'package-lock.json', 'README.md',
    'CHANGELOG.md', 'LICENSE', 'hacs.json',
)]
for directory in ('src', 'dist', 'tests', 'demo', 'examples', 'docs', '.github'):
    files.extend(path for path in (ROOT / directory).rglob('*') if path.is_file())
files.extend(ROOT / 'scripts' / name for name in (
    'build.mjs', 'prepare-freebox-image.mjs', 'inspect-home-assistant.mjs',
    'test-provider-home-assistant.mjs', 'package-release.py',
))
for path in files:
    relative = path.relative_to(ROOT)
    assert not path.is_symlink(), relative
    assert not any(part in ('artifacts', 'node_modules', '.env', '__pycache__') for part in relative.parts), relative
    assert path.suffix not in ('.png', '.jpeg', '.jpg', '.webp'), relative
with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(files):
        archive.write(path, Path('isp-box-card') / path.relative_to(ROOT))
# Check the member list AND bytes, not merely that zip creation returned success.
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == {str(Path('isp-box-card') / path.relative_to(ROOT)) for path in files}
    for path in files:
        assert archive.read(str(Path('isp-box-card') / path.relative_to(ROOT))) == path.read_bytes()
print(json.dumps({'archive': str(output), 'files': len(files), 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'all_member_bytes_verified': True}, indent=2))
