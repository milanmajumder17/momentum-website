# Matrix Reasoning SVG Generator

Based on **Carpenter, Just & Shell (1990)** — analytic theory of fluid intelligence (Raven-like matrices).

## 5 rules: how to generate SVG items

### 1. Constant in a row — complexity 1 → b=-2.5
Same shape repeats across each row (vary shape per row). Generate: pick 1 shape per row from {circle,square,triangle,diamond}, fill 3 cells identically. Missing cell = row-3 shape. Distractors = other 3 shapes. SVG: `<circle>/<rect>/<polygon>` centered in each cell.

### 2. Quantitative pairwise progression — complexity 2 → b=-1.25
Dot count grows across the row: n, n+step, n+2·step (start 1–2, step 1–2). Generate: `dotGrid(n)` helper draws n dots in grid layout. Missing = start+2·step. Distractors = ±1, +2 counts. SVG: N `<circle r=5>` per cell.

### 3. Figure addition/subtraction (XOR) — complexity 3 → b=0.0
Row3 = Row1 XOR Row2 bitwise (bit0=circle, bit1=square). Generate: random 2-bit values a,b per row; c=a^b. Missing = row3 c. Distractors = other 3 bit-values. SVG: overlay circle+square or empty-dot for 0.

### 4. Distribution of 3 values — complexity 4 → b=+1.25
Each row is a permutation of {circle,triangle,square} (Latin-square style). Generate: 3 random permutations. Missing = last element of row 3 (only shape completing the set). Distractors = the other 2 shapes + small-size variant of correct. SVG: shape primitives per cell.

### 5. Spatial rotation — complexity 5 → b=+2.5
Asymmetric arrow rotates 90° across the row: start, start+90, start+180. Generate: random start per row (0/90/180/270). Missing = start3+180. Distractors = other 3 rotations. SVG: `<g transform="rotate(deg)">` around arrow polygon.

## Cognitive Complexity → IRT b mapping

Linear map (1–5 → −2.5…+2.5): `b = -2.5 + (c-1)*1.25`. Rationale: Carpenter et al. show difficulty ≈ number of relations + WM load; each added relation adds ≈1.25 logits.

| rule | c | b |
|---|---|---|
| constant | 1 | -2.5 |
| progression | 2 | -1.25 |
| xor | 3 | 0.0 |
| distribution | 4 | +1.25 |
| rotation | 5 | +2.5 |

## Run

```
node generate.js --rule=all --count=2 --seed=42
node generate.js --rule=rotation --count=10 --seed=7
```

Output: `output/matrix_XXX.svg`, `output/matrix_XXX_options.svg`, `output/metadata.json` (item_id, rule, complexity, irt_b, key).
