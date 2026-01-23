# Cómo convertir los tutoriales a PDF y PowerPoint

## Archivos creados:

1. **TUTORIAL-DEPLOY-WEB-APP.md** - Tutorial completo (para PDF)
2. **TUTORIAL-DEPLOY-SLIDES.md** - Versión slides (para PowerPoint)

---

## OPCIÓN A: Convertir a PDF (Método más fácil)

### Usando Visual Studio Code:
1. Abrí el archivo `.md` en VS Code
2. Instalá la extensión "Markdown PDF"
3. Click derecho → "Markdown PDF: Export (pdf)"

### Usando el navegador:
1. Abrí el archivo en un editor de Markdown online:
   - https://dillinger.io
   - https://stackedit.io
2. Pegá el contenido
3. Exportar como PDF

### Usando Pandoc (línea de comandos):
```bash
# Instalar pandoc
brew install pandoc

# Convertir a PDF
pandoc TUTORIAL-DEPLOY-WEB-APP.md -o TUTORIAL-DEPLOY-WEB-APP.pdf
```

---

## OPCIÓN B: Convertir a PowerPoint

### Método 1: Marp (Recomendado)
1. Instalá la extensión "Marp for VS Code"
2. Abrí TUTORIAL-DEPLOY-SLIDES.md
3. Click en el ícono de Marp → Export → PPTX

### Método 2: Pandoc
```bash
pandoc TUTORIAL-DEPLOY-SLIDES.md -o TUTORIAL-DEPLOY-SLIDES.pptx
```

### Método 3: Manual
1. Abrí PowerPoint
2. Creá slides siguiendo la estructura del archivo
3. Cada "# Slide N:" es una diapositiva nueva

---

## OPCIÓN C: Servicios Online Gratuitos

### Para PDF:
- https://www.markdowntopdf.com
- https://md2pdf.netlify.app

### Para PowerPoint:
- https://www.slidesgo.com (templates)
- Copiar contenido manualmente a Google Slides → Exportar como PPTX

---

## Tip: Google Docs

1. Crear nuevo documento en Google Docs
2. Pegar el contenido del tutorial
3. Formatear títulos (Título 1, Título 2, etc.)
4. Archivo → Descargar → PDF o PPTX
