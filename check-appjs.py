import re

src = open(r'C:\Users\86198\.zcode\workspace\default\cute-face-grid\app.js', encoding='utf-8').read()
s = re.sub(r'//[^\n]*', '', src)
s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
s = re.sub(r"'(?:\\.|[^'\\])*'", "''", s)
ok = True
for a, b in [('{', '}'), ('(', ')'), ('[', ']')]:
    ca, cb = s.count(a), s.count(b)
    print(a, ca, b, cb, 'OK' if ca == cb else 'MISMATCH')
    ok = ok and ca == cb
raise SystemExit(0 if ok else 1)
