"""Commit identity check, used by the git hooks and by push CI.

Every commit must be authored and committed by the project identity below, and any
Co-authored-by / Signed-off-by trailer may only name that identity.
"""
import re
import subprocess
import sys
from pathlib import Path


IDENTITY = b'nvq2309 <nvq2309@gmail.com>'
TRAILER = re.compile(rb'^[ \t]*(?:co-authored-by|signed-off-by):[ \t]*(.*?)[ \t]*\r?$', re.I | re.M)


def git(*args, **kwargs):
    return subprocess.check_output(['git', *args], **kwargs)


def require_identity(value, subject):
    # `value` is "Name <email> <timestamp> <tz>"; drop the timestamp and time zone.
    if value.strip().rsplit(b' ', 2)[0] != IDENTITY:
        sys.exit(f'Blocked: {subject} must be {IDENTITY.decode()}.')


def check_message(message, subject):
    for trailer in TRAILER.finditer(message):
        if trailer.group(1) != IDENTITY:
            sys.exit(f'Blocked: trailer in {subject} must name {IDENTITY.decode()}.')


def check_staged():
    for role in ('AUTHOR', 'COMMITTER'):
        require_identity(git('var', f'GIT_{role}_IDENT'), role.lower())


def check_history(tips):
    if not tips:
        return
    for oid in git('rev-list', *tips, '--').split():
        data = git('cat-file', 'commit', oid.decode())
        header, message = data.split(b'\n\n', 1)
        subject = f'commit {oid.decode()[:12]}'
        for role in (b'author', b'committer'):
            prefix = role + b' '
            value = next(line[len(prefix):] for line in header.splitlines()
                         if line.startswith(prefix))
            require_identity(value, f'{role.decode()} of {subject}')
        check_message(message, f'message of {subject}')


def check_push():
    tips = []
    for row in sys.stdin.buffer:
        _, local_oid, _, _ = row.split()
        if local_oid.strip(b'0'):
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
        check_history(['HEAD'])
    else:
        sys.exit(f'Unknown check: {mode}')
