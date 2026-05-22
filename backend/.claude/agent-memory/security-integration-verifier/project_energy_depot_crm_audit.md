---
name: energy-depot-crm-audit-2026-05
description: Hallazgos clave de auditoría de seguridad y performance del CRM Energy Depot (mayo 2026)
metadata:
  type: project
---

Auditoría realizada 2026-05-22. Estado general: CONDITIONAL PASS.

**Hallazgos críticos/altos resueltos:**
- JWT en localStorage (XSS risk) — pendiente migrar a httpOnly cookie
- Endpoints debug `/api/public/debug-lead/:id` y `/api/public/debug-luma-*` expuestos sin autenticación en producción
- Fallback hardcodeado `PUBLIC_LEAD_SECRET = 'energy-depot-public-2026'` si env var no está seteada
- `rejectUnauthorized: false` en SMTP de emailController y webhookController (MITM risk)
- Body limit `50mb` demasiado permisivo para endpoints públicos de subida de archivos

**Strengths confirmadas:**
- authMiddleware valida JWT + DB active check + revocation cache
- Twilio webhook signature validation implementada (con flag escape TWILIO_SKIP_VALIDATION)
- Rate limiting por categoría: loginLimiter, aiLimiter, publicTokenLimiter, webhookLimiter
- Todas las queries a DB usan parámetros ($1, $2) — no SQL injection
- Service worker excluye rutas /api/ del cache
- CORS whitelist por origin
- Helmet CSP configurado

**Why:** Auditoría solicitada antes de posible expansión del sistema.
**How to apply:** En futuras revisiones de este codebase, verificar primero estos puntos ya conocidos y su estado de remediación.
