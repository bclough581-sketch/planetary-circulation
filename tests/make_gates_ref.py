"""Independent reference for tests/test_gates.js.

Re-implements Wilder RSI(14) and the 126-bar range position in plain Python,
using the same deterministic LCG walk the test builds. No files are read or
written; the JSON result goes to stdout so a clean checkout can reproduce it.
"""
import json

RSI_LEN = 14
RANGE_DAYS = 126

seed = 7
def rnd():
    global seed
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296

c, closes = 100.0, []
for _ in range(200):
    c *= 1 + (rnd() - 0.5) * 0.04
    closes.append(c)

gain = loss = 0.0
for i in range(1, RSI_LEN + 1):
    d = closes[i] - closes[i - 1]
    if d >= 0: gain += d
    else: loss -= d
gain /= RSI_LEN; loss /= RSI_LEN
for i in range(RSI_LEN + 1, len(closes)):
    d = closes[i] - closes[i - 1]
    gain = (gain * (RSI_LEN - 1) + (d if d > 0 else 0)) / RSI_LEN
    loss = (loss * (RSI_LEN - 1) + (-d if d < 0 else 0)) / RSI_LEN
rsi = 100.0 if loss == 0 else 100 - 100 / (1 + gain / loss)

w = closes[-RANGE_DAYS:]
hi, lo = max(x * 1.01 for x in w), min(x * 0.99 for x in w)
pos = (w[-1] - lo) / (hi - lo)
print(json.dumps({"rsi": rsi, "pos": pos}))
