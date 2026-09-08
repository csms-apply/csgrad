#!/usr/bin/env python3
"""Publish a complete build without removing the currently served directory."""
import ctypes
import os
import json
import shutil
import re
from pathlib import Path
import sys
import uuid


def activate(site, release):
    site = Path(site).resolve()
    release = Path(release).resolve()
    if release.parent != site / '.site-releases':
        raise ValueError('Release must be directly inside .site-releases')
    for page in ('index.html', 'en/index.html', 'school-positioning-result/index.html', 'en/school-positioning-result/index.html'):
        if not (release / page).is_file():
            raise ValueError(f'Incomplete release: missing {page}')
    live = site / 'build'
    # Keep precisely the previous build's own assets for already open tabs.
    # Record fresh assets before copying so retention does not grow recursively.
    previous_release = live.resolve() if live.exists() else None
    manifest = '.original-assets.json'
    fresh = [str(p.relative_to(release)) for p in release.rglob('*')
             if p.is_file() and 'assets' in p.relative_to(release).parts]
    if live.is_dir():
        if (live / manifest).is_file():
            previous = json.loads((live / manifest).read_text())
        else:
            previous = [str(p.relative_to(live)) for p in live.rglob('*')
                        if p.is_file() and 'assets' in p.relative_to(live).parts]
        for name in previous:
            relative = Path(name)
            if relative.is_absolute() or '..' in relative.parts or 'assets' not in relative.parts:
                raise ValueError('Invalid previous asset manifest')
            source, target = live / relative, release / relative
            if source.is_file() and not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
    (release / manifest).write_text(json.dumps(fresh))
    staging = site / ('.build-link-' + uuid.uuid4().hex)
    staging.symlink_to(os.path.relpath(release, site), target_is_directory=True)
    try:
        if live.is_dir() and not live.is_symlink():
            # Linux atomically exchanges a legacy directory and the new symlink.
            # Unsupported platforms fail with the old directory untouched.
            libc = ctypes.CDLL(None, use_errno=True)
            renameat2 = getattr(libc, 'renameat2', None)
            if renameat2 is None:
                raise RuntimeError('Initial activation requires Linux renameat2')
            renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
            renameat2.restype = ctypes.c_int
            if renameat2(-100, os.fsencode(staging), -100, os.fsencode(live), 2):
                raise OSError(ctypes.get_errno(), 'Atomic build exchange failed')
            previous_release = site / '.site-releases' / ('legacy-' + uuid.uuid4().hex)
            staging.rename(previous_release)
        else:
            os.replace(staging, live)
    finally:
        if staging.is_symlink():
            staging.unlink()
    # Only remove releases created by this deployer, keeping one rollback build.
    for candidate in (site / '.site-releases').iterdir():
        if (re.fullmatch(r'(release-[A-Za-z0-9]{8}|legacy-[a-f0-9]{32})', candidate.name)
                and candidate.is_dir() and not candidate.is_symlink()
                and candidate.resolve() not in (release, previous_release)):
            shutil.rmtree(candidate)


if __name__ == '__main__':
    activate(sys.argv[1], sys.argv[2])
