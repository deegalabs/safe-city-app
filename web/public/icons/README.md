# Ícones PWA

- `icon.svg` — fonte (escudo + "S", tema SHIELD).
- `icon-192.png` e `icon-512.png` — gerados a partir do SVG para o manifest PWA.

Para regenerar os PNGs:

```bash
pnpm icons:generate
```

Requer a dependência de desenvolvimento `sharp` (já no package.json).
