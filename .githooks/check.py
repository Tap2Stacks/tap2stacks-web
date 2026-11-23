import os
import re
import subprocess
import sys
from pathlib import Path


IDENTITY = b'nvq2309 <nvq2309@gmail.com>'
SEPARATOR = rb'(?:[ \t_.-]|\xc2\xa0|\xe2\x80[\x90-\x95])*'
DENIED = re.compile(
    rb'ta[p]l|sto[c]ks?' + SEPARATOR + rb'tap[p]ing|sto[c]k' + SEPARATOR +
    rb'ta[p]', re.I,
)
TRAILER = re.compile(rb'^[ \t]*(?:co-authored-by|signed-off-by):[ \t]*(.*?)[ \t]*\r?$', re.I | re.M)


def git(*args, **kwargs):
    return subprocess.check_output(['git', *args], **kwargs)


def require_clean(data, subject):
    if DENIED.search(data):
        sys.exit(f'Blocked: disallowed name in {subject}.')


def require_identity(value, subject):
    if value.strip().rsplit(b' ', 2)[0] != IDENTITY:
        sys.exit(f'Blocked: {subject} must be {IDENTITY.decode()}.')


def check_message(message, subject):
    require_clean(message, subject)
    for trailer in TRAILER.finditer(message):
        if trailer.group(1) != IDENTITY:
            sys.exit(f'Blocked: non-project identity trailer in {subject}.')


def objects(ids):
    if not ids:
        return
    batch = git('cat-file', '--batch', input=b'\n'.join(ids) + b'\n')
    offset = 0
    while offset < len(batch):
        end = batch.index(b'\n', offset)
        oid, kind, size = batch[offset:end].split()
        offset = end + 1 + int(size)
        yield oid, kind, batch[end+1:offset]
        offset += 1


def check_staged():
    for role in ('AUTHOR', 'COMMITTER'):
        require_identity(git('var', f'GIT_{role}_IDENT'), role.lower())
    ref = git('rev-parse', '--symbolic-full-name', 'HEAD').strip()
    require_clean(ref, 'branch name')
    entries = git('diff', '--cached', '--raw', '-z', '--no-abbrev', '--no-renames',
                  '--diff-filter=ACMRT').split(b'\0')
    blobs = {}
    for details, path in zip(entries[::2], entries[1::2]):
        mode, oid = details.split()[1:4:2]
        require_clean(path, 'staged path')
        if mode != b'160000':
            blobs[oid] = os.fsdecode(path)
    for oid, _, data in objects(blobs):
        require_clean(data, f'staged content ({blobs[oid]!r})')


def check_history(tips):
    if not tips:
        return
    ids = git('rev-list', '--objects', '--no-object-names', *tips, '--').splitlines()
    for oid, kind, data in objects(ids):
        subject = f'{kind.decode()} {oid.decode()[:12]}'
        if kind == b'commit':
            header, message = data.split(b'\n\n', 1)
            for role in (b'author', b'committer'):
                prefix = role + b' '
                value = next(line[len(prefix):] for line in header.splitlines()
                             if line.startswith(prefix))
                require_identity(value, f'{role.decode()} of {subject}')
            check_message(message, f'message of {subject}')
        elif kind == b'tree':
            for path in git('ls-tree', '--name-only', '-z', oid).split(b'\0'):
                require_clean(path, f'path in {subject}')
        else:
            require_clean(data, subject)


def check_push():
    tips = []
    for row in sys.stdin.buffer:
        local_ref, local_oid, remote_ref, _ = row.split()
        if local_oid.strip(b'0'):
            require_clean(local_ref, 'local ref')
            require_clean(remote_ref, 'destination ref')
            tips.append(local_oid)
    check_history(tips)


if __name__ == '__main__':
    mode, *args = sys.argv[1:]
    if mode == 'pre-commit':
        check_staged()
    elif mode == 'commit-msg':
        check_message(Path(args[0]).read_bytes(), 'commit message')
    elif mode == 'pre-push':
        check_push()
    elif mode == 'ci':
        for variable in ('GITHUB_REF', 'GITHUB_ACTOR'):
            require_clean(os.fsencode(os.environ.get(variable, '')), variable)
        check_history(['HEAD'])
    else:
        sys.exit(f'Unknown check: {mode}')
