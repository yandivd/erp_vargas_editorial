---
name: task.md
about: Standard for any task
title: ''
labels: ''
assignees: ''

---

---
name: 🚀 Tarea / Funcionalidad
about: Crea una tarea para el desarrollo del ERP
title: "[FRONTEND] Breve descripción de la tarea"
labels: ''
assignees: ''
---

## 📖 Contexto
<!-- ¿Por qué es necesaria esta tarea? ¿Qué problema resuelve? -->
*Ejemplo: Al crear un libro, necesito que el sistema calcule el precio estimado basándose en la cantidad de páginas para no hacerlo a mano.*

## ✅ Criterios de Aceptación
<!-- ¿Qué debe pasar para considerar esta tarea como terminada? (Marca los checkboxes cuando lo pruebes) -->
- [ ] El usuario debe poder ingresar: título, autor, cantidad de páginas y precio.
- [ ] El precio debe auto-rellenarse aplicando el algoritmo de cálculo según las páginas.
- [ ] La imagen debe ser un campo opcional.
- [ ] El layout debe coincidir con el diseño de Figma (si aplica).

## 🛠️ Detalles Técnicos
<!-- Notas para ti mismo o para tu yo del futuro sobre cómo implementarlo -->
- **Módulo:** Frontend / Backend / Base de Datos
- **Ruta:** `/libros/nuevo`
- **Componentes afectados:** `BookForm.tsx`, `PriceCalculator.ts`
- **Endpoints involucrados:** `POST /api/books`

## 📸 Recursos / Referencias
<!-- Enlaces a Figma, documentación, o capturas de pantalla -->
- Diseño de Figma: [Enlace]
- Documentación Next.js: [Enlace]

## 🔗 Dependencias
<!-- ¿Esta tarea depende de otra? (Ej: Necesita que el backend cree la tabla de libros) -->
- Bloqueado por: #[Número de Issue de Backend]
- Relacionado con: #[Número de Issue relacionado]
