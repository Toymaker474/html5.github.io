from pathlib import Path
import base64
import gzip

payload = Path('nexus-glass-science-cube/patch-machine-organism-v5.py.gz.b64')
source = gzip.decompress(base64.b64decode(payload.read_text(encoding='utf-8'))).decode('utf-8')
exec(compile(source, str(payload), 'exec'), {'__name__': '__main__'})
