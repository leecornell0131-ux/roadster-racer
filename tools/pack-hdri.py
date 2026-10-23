# Packs a Radiance .hdr into a grayscale PNG of RGBE bytes (artifacts can't serve .hdr).
# Each HDR pixel becomes 4 consecutive gray pixels: R, G, B mantissas and the exponent (+128).
# usage: python3 tools/pack-hdri.py in.hdr out.png [downscale=2]
import sys, numpy as np
from PIL import Image

def read_hdr(path):
    data = open(path, 'rb').read()
    pos = 0
    while True:
        end = data.index(b'\n', pos); line = data[pos:end]; pos = end + 1
        if line == b'': break
    end = data.index(b'\n', pos); dims = data[pos:end].split(); pos = end + 1
    H, W = int(dims[1]), int(dims[3])
    out = np.zeros((H, W, 4), np.uint8)
    buf = np.frombuffer(data, np.uint8)
    for y in range(H):
        if buf[pos] == 2 and buf[pos + 1] == 2:
            pos += 4
            for c in range(4):
                x = 0
                while x < W:
                    n = int(buf[pos]); pos += 1
                    if n > 128:
                        n -= 128; out[y, x:x + n, c] = buf[pos]; pos += 1
                    else:
                        out[y, x:x + n, c] = buf[pos:pos + n]; pos += n
                    x += n
        else:
            out[y] = buf[pos:pos + W * 4].reshape(W, 4); pos += W * 4
    e = out[..., 3].astype(np.int32)
    f = out[..., :3].astype(np.float64) * np.where(e > 0, np.ldexp(1.0, e - 136), 0)[..., None]
    return f

src, dst = sys.argv[1], sys.argv[2]
k = int(sys.argv[3]) if len(sys.argv) > 3 else 2
f = read_hdr(src)
H, W = f.shape[0] // k * k, f.shape[1] // k * k
f = f[:H, :W].reshape(H // k, k, W // k, k, 3).mean((1, 3))
m = f.max(-1)
e = np.clip(np.ceil(np.log2(np.maximum(m, 1e-32))), -127, 127)
rgb = np.clip(f * np.ldexp(1.0, (8 - e).astype(np.int32))[..., None], 0, 255).astype(np.uint8)
ee = (e + 128).astype(np.uint8); ee[m < 1e-30] = 0
out = np.concatenate([rgb, ee[..., None]], -1).reshape(H // k, (W // k) * 4)
Image.fromarray(out, 'L').save(dst, optimize=True)
y, x = np.unravel_index(np.argmax(m), m.shape)
print(dst, out.shape, 'max', f.max(), 'sun px', x, y, 'of', W // k, H // k)
