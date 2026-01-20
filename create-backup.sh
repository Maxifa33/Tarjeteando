#!/bin/bash
# Script de backup automático
# Uso: ./create-backup.sh [descripcion_opcional]

BACKUP_DIR="/Users/maxi/Documents/tarjetas-proyecto/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DESCRIPTION=${1:-"auto"}
BACKUP_NAME="backup_${DESCRIPTION}_${TIMESTAMP}.tar.gz"

cd /Users/maxi/Documents/tarjetas-proyecto

# Crear backup excluyendo node_modules y otros archivos grandes
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}" \
  --exclude='*/node_modules/*' \
  --exclude='*/node_modules 2/*' \
  --exclude='*/node_modules 3/*' \
  --exclude='*/.git/*' \
  --exclude='*/dist/*' \
  --exclude='*/build/*' \
  --exclude='*.log' \
  Backend/ Frontend/

# Verificar que el backup se creó correctamente
if [ -f "${BACKUP_DIR}/${BACKUP_NAME}" ]; then
  SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}" | cut -f1)
  echo "✅ Backup creado exitosamente: ${BACKUP_NAME} (${SIZE})"

  # Mantener solo los últimos 10 backups
  cd "${BACKUP_DIR}"
  ls -t backup_*.tar.gz | tail -n +11 | xargs -r rm
  echo "📦 Backups actuales:"
  ls -lh backup_*.tar.gz 2>/dev/null | tail -5
else
  echo "❌ Error al crear el backup"
  exit 1
fi
