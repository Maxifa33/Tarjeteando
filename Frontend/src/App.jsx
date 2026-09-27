import React, { useState, useEffect, useCallback, useMemo } from 'react';
import storage from './services/storage';
import { APP_VERSION } from './novedades';
import { parseUltimosConsumos, leerHojas, EXTENSIONES_CONSUMOS } from './services/consumos/index.js';
import { agruparBloques, aliasConocido } from './services/consumos/ciclos.js';
import { importarGrupos, conciliarResumen, getAlias, getPlantillas, guardarPlantilla, guardarBanco } from './services/consumos/live.js';
import AppShell from './ui/AppShell.jsx';
import Seg from './ui/Seg.jsx';
import { manchasDeLuz, manchasElegida } from './ui/identidad.js';
import MesView from './views/MesView.jsx';
import TarjetasView from './views/TarjetasView.jsx';
import MovimientosView from './views/MovimientosView.jsx';
import CuotasView from './views/CuotasView.jsx';
import ConsumosLiveView from './views/ConsumosLiveView.jsx';
import OnboardingWizard from './views/Onboarding.jsx';
import { NovedadesModal, GuiaView } from './views/Guia.jsx';
import { armarTarjetas, buscarTarjeta, nombreVisible, migrarNombresLive } from './services/tarjetas.js';
import { serieEvolucion, detalleMes } from './services/evolucion.js';
import { cicloDePago, cuotasDelMes, desfasePorTarjeta, proximoMes, sumarMeses, composicionPorTarjeta, composicionDesdeTarjetas, fijosPorTarjeta } from './services/mes.js';
import { clasesApariencia, modoEfectivo } from './services/apariencia.js';
import {
  construirCadenas,
  aplicarOverrides,
  resumenFijos,
  preguntasPendientes,
  claveComercio,
  regexDeClave,
  periodoDeMovimiento
} from './services/series';
import {
  construirPlanes, formatearParaVista
} from './services/cuotas';
import {
  Receipt, CreditCard, Tag, Upload, Calendar, AlertCircle, Sun, Bell, Settings, X, FileText, CheckCircle, XCircle, Sparkles, RefreshCcw, Download, Edit3, Plus, HelpCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = `${API_URL}/api/v1`;

// OnboardingWizard → views/Onboarding.jsx (fase 6).

// Función helper para formatear montos en pesos argentinos (siempre con 2 decimales)
const formatMonto = (value, prefix = '$') => {
  const num = Number(value) || 0;
  return `${prefix}${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Función helper para formatear montos en dólares
const formatMontoDolares = (value) => {
  const num = Number(value) || 0;
  return `USD ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Settings Modal Component - Fondo sólido y cierre al clickear fuera
const SettingsModal = ({ isOpen, onClose, tarjetas, reglas, movimientos, resumenes, cuotasActivas, onRefreshData, apariencia, onApariencia, initialTab = 'tarjetas' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Actualizar tab cuando cambia initialTab
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);
  const [editingTarjeta, setEditingTarjeta] = useState(null);
  const [newTarjeta, setNewTarjeta] = useState({ nombre: '', tipo: 'VISA', banco: '' });
  const [preferencias, setPreferencias] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('preferencias') || '{}');
    } catch { return {}; }
  });
  const [alertas, setAlertas] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('alertas') || '{"vencimiento": true, "cuotaFinal": true, "diasAntes": 3}');
    } catch { return { vencimiento: true, cuotaFinal: true, diasAntes: 3 }; }
  });

  useEffect(() => {
    localStorage.setItem('preferencias', JSON.stringify(preferencias));
  }, [preferencias]);

  useEffect(() => {
    localStorage.setItem('alertas', JSON.stringify(alertas));
  }, [alertas]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'tarjetas', label: 'Tarjetas', icon: CreditCard },
    { id: 'preferencias', label: 'Preferencias', icon: Settings },
    { id: 'alertas', label: 'Alertas', icon: Bell },
    { id: 'datos', label: 'Datos', icon: Download },
    { id: 'temas', label: 'Apariencia', icon: Sun },
  ];

  // Función para exportar CSV
  const exportarCSV = (tipo) => {
    let datos = [];
    let nombreArchivo = '';
    let headers = [];

    switch (tipo) {
      case 'movimientos':
        headers = ['Fecha', 'Tarjeta', 'Descripción', 'Cuota', 'Monto Pesos', 'Monto USD'];
        datos = movimientos.map(m => [
          m.fecha_compra,
          m.tarjeta,
          m.referencia_limpia || m.referencia_original,
          m.cuota_texto || '-',
          m.monto_pesos || 0,
          m.monto_dolares || ''
        ]);
        nombreArchivo = 'movimientos';
        break;
      case 'cuotas':
        headers = ['Descripción', 'Tarjeta', 'Cuota Actual', 'Total Cuotas', 'Monto Cuota', 'Monto Total', 'Restantes'];
        datos = cuotasActivas.map(c => [
          c.descripcion || c.referencia_limpia,
          c.tarjeta,
          c.cuotas_pagadas || c.cuota_actual,
          c.total_cuotas,
          c.monto_cuota,
          c.monto_total,
          c.cuotas_restantes
        ]);
        nombreArchivo = 'cuotas';
        break;
      case 'resumenes':
        headers = ['Tarjeta', 'Mes', 'Año', 'Total Pesos', 'Total USD', 'Consumos Pesos', 'Movimientos'];
        datos = resumenes.map(r => [
          r.tarjeta,
          r.mes,
          r.anio,
          r.total_a_pagar_pesos,
          r.total_a_pagar_dolares || '',
          r.total_consumos_pesos,
          r.cantidad_movimientos
        ]);
        nombreArchivo = 'resumenes';
        break;
      default:
        return;
    }

    const csv = [headers.join(','), ...datos.map(row => row.map(cell =>
      typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
    ).join(','))].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddTarjeta = async () => {
    if (!newTarjeta.nombre || !newTarjeta.banco) return;
    try {
      storage.saveTarjeta(newTarjeta);
      setNewTarjeta({ nombre: '', tipo: 'VISA', banco: '' });
      onRefreshData?.();
    } catch (e) { console.error('Error agregando tarjeta:', e); }
  };

  const handleDeleteTarjeta = async (id) => {
    if (!confirm('¿Eliminar esta tarjeta y todos sus datos?')) return;
    try {
      // Eliminar tarjeta y sus resúmenes/movimientos asociados
      const tarjetasData = storage.getTarjetas();
      const tarjeta = tarjetasData.find(t => t.nombre === id || t.id === id);
      if (tarjeta) {
        // Eliminar resúmenes de esta tarjeta
        const resumenes = storage.getResumenes();
        resumenes.filter(r => r.tarjeta === tarjeta.nombre).forEach(r => {
          storage.deleteResumen(r.id);
        });
        // Eliminar tarjeta
        const nuevasTarjetas = tarjetasData.filter(t => t.nombre !== tarjeta.nombre);
        localStorage.setItem('tarjetas_lista', JSON.stringify(nuevasTarjetas));
      }
      onRefreshData?.();
    } catch (e) { console.error('Error eliminando tarjeta:', e); }
  };

  const handleUpdateTarjeta = async (id, data) => {
    try {
      const tarjetasData = storage.getTarjetas();
      const index = tarjetasData.findIndex(t => t.nombre === id || t.id === id);
      if (index >= 0) {
        tarjetasData[index] = { ...tarjetasData[index], ...data };
        localStorage.setItem('tarjetas_lista', JSON.stringify(tarjetasData));
      }
      setEditingTarjeta(null);
      onRefreshData?.();
    } catch (e) { console.error('Error actualizando tarjeta:', e); }
  };

  const handleAddRegla = async () => {
    if (!newRegla.patron || !newRegla.nombre_limpio) return;
    try {
      // Guardar en localStorage
      storage.saveRegla(newRegla);

      // También enviar al backend para que se aplique al procesar PDFs
      try {
        await fetch(`${API_BASE}/reglas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patron: newRegla.patron,
            nombre_limpio: newRegla.nombre_limpio
          })
        });
      } catch (backendError) {
        // Silently fail - backend sync is optional
      }

      setNewRegla({ patron: '', nombre_limpio: '' });
      onRefreshData?.();
    } catch (e) { console.error('Error agregando regla:', e); }
  };

  const handleDeleteRegla = async (id) => {
    try {
      // Obtener el patrón antes de eliminar para buscar en backend
      const reglas = storage.getReglas();
      const regla = reglas.find(r => r.id === id);

      storage.deleteRegla(id);

      // También eliminar del backend si existe
      if (regla) {
        try {
          await fetch(`${API_BASE}/reglas/${id}`, { method: 'DELETE' });
        } catch (backendError) {
          // Silently fail - backend sync is optional
        }
      }

      onRefreshData?.();
    } catch (e) { console.error('Error eliminando regla:', e); }
  };

  const handleExportAll = () => {
    const allData = storage.exportAll();
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tarjetas_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.preferencias) {
          setPreferencias(data.preferencias);
        }
        if (data.alertas) {
          setAlertas(data.alertas);
        }
        alert('Configuración importada correctamente');
      } catch (e) {
        alert('Error al importar: archivo inválido');
      }
    };
    reader.readAsText(file);
  };


  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden mx-4"
        style={{ backgroundColor: 'var(--solid)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--sep)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--label)' }}>Configuración</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--fill2)] transition-colors"
            style={{ backgroundColor: 'transparent' }}
          >
            <X className="w-5 h-5" style={{ color: 'var(--label2)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--sep)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                         ${activeTab === tab.id
                           ? 'border-b-2 border-[var(--label)] text-[var(--label)]'
                           : 'hover:bg-[var(--fill2)]'}`}
              style={activeTab !== tab.id ? { color: 'var(--label2)' } : {}}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[var(--fill)] text-[var(--label)]">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
          {/* Gestión de Tarjetas */}
            {activeTab === 'tarjetas' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--label)' }}>Gestión de Tarjetas</h3>

                {/* Nueva tarjeta */}
                <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--fill2)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--label)' }}>Agregar nueva tarjeta</p>
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={newTarjeta.nombre}
                      onChange={(e) => setNewTarjeta({...newTarjeta, nombre: e.target.value})}
                      className="px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: 'var(--fill)',
                        borderColor: 'var(--sep)',
                        color: 'var(--label)'
                      }}
                    />
                    <select
                      value={newTarjeta.tipo}
                      onChange={(e) => setNewTarjeta({...newTarjeta, tipo: e.target.value})}
                      className="px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: 'var(--fill)',
                        borderColor: 'var(--sep)',
                        color: 'var(--label)'
                      }}
                    >
                      <option value="VISA">VISA</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="American Express">American Express</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Banco"
                      value={newTarjeta.banco}
                      onChange={(e) => setNewTarjeta({...newTarjeta, banco: e.target.value})}
                      className="px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: 'var(--fill)',
                        borderColor: 'var(--sep)',
                        color: 'var(--label)'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleAddTarjeta}
                    disabled={!newTarjeta.nombre || !newTarjeta.banco}
                    className="px-4 py-2 rounded-lg bg-[var(--inv)] text-[var(--inv-text)] text-sm font-medium
                               hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Agregar Tarjeta
                  </button>
                </div>

                {/* Lista de tarjetas */}
                <div className="space-y-3">
                  {tarjetas.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--fill2)' }}>
                      {editingTarjeta === t.id ? (
                        <div className="flex-1 flex items-center gap-3">
                          <input
                            type="text"
                            defaultValue={t.nombre}
                            id={`edit-nombre-${t.id}`}
                            className="px-3 py-1.5 rounded-lg border text-sm flex-1"
                            style={{
                              backgroundColor: 'var(--fill)',
                              borderColor: 'var(--sep)',
                              color: 'var(--label)'
                            }}
                          />
                          <button
                            onClick={() => handleUpdateTarjeta(t.id, {
                              nombre: document.getElementById(`edit-nombre-${t.id}`).value
                            })}
                            className="px-3 py-1.5 rounded-lg bg-[var(--inv)] text-[var(--inv-text)] text-sm"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingTarjeta(null)}
                            className="px-3 py-1.5 rounded-lg text-sm"
                            style={{ backgroundColor: 'var(--fill)', color: 'var(--label)' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="font-medium" style={{ color: 'var(--label)' }}>{t.nombre}</p>
                            <p className="text-sm" style={{ color: 'var(--label2)' }}>{t.tipo} - {t.banco}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingTarjeta(t.id)}
                              className="p-2 rounded-lg hover:bg-[var(--fill2)] transition-colors"
                            >
                              <Edit3 className="w-4 h-4" style={{ color: 'var(--label2)' }} />
                            </button>
                            <button
                              onClick={() => handleDeleteTarjeta(t.nombre)}
                              className="p-2 rounded-lg hover:bg-[var(--fill2)] transition-colors"
                            >
                              <XCircle className="w-4 h-4 text-[var(--danger)]" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {tarjetas.length === 0 && (
                    <p className="text-center py-8" style={{ color: 'var(--label2)' }}>No hay tarjetas registradas</p>
                  )}
                </div>
              </div>
            )}

            {/* Preferencias */}
            {activeTab === 'preferencias' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--label)' }}>Preferencias de Usuario</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--label)' }}>
                      Moneda por defecto
                    </label>
                    <select
                      value={preferencias.monedaDefault || 'ARS'}
                      onChange={(e) => setPreferencias({...preferencias, monedaDefault: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border"
                      style={{
                        backgroundColor: 'var(--fill)',
                        borderColor: 'var(--sep)',
                        color: 'var(--label)'
                      }}
                    >
                      <option value="ARS">Pesos Argentinos (ARS)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--label)' }}>
                      Formato de fechas
                    </label>
                    <select
                      value={preferencias.formatoFecha || 'dd/mm/yyyy'}
                      onChange={(e) => setPreferencias({...preferencias, formatoFecha: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border"
                      style={{
                        backgroundColor: 'var(--fill)',
                        borderColor: 'var(--sep)',
                        color: 'var(--label)'
                      }}
                    >
                      <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                      <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                      <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Alertas */}
            {activeTab === 'alertas' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--label)' }}>Configuración de Alertas</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--fill2)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--label)' }}>Alerta de vencimiento</p>
                      <p className="text-sm" style={{ color: 'var(--label2)' }}>Notificar antes del vencimiento de pago</p>
                    </div>
                    <button
                      onClick={() => setAlertas({...alertas, vencimiento: !alertas.vencimiento})}
                      className={`w-12 h-6 rounded-full transition-colors relative
                                 ${alertas.vencimiento ? 'bg-[var(--r2)]' : 'bg-[var(--fill)]'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                                      ${alertas.vencimiento ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--fill2)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--label)' }}>Alerta de última cuota</p>
                      <p className="text-sm" style={{ color: 'var(--label2)' }}>Notificar cuando una compra llega a su última cuota</p>
                    </div>
                    <button
                      onClick={() => setAlertas({...alertas, cuotaFinal: !alertas.cuotaFinal})}
                      className={`w-12 h-6 rounded-full transition-colors relative
                                 ${alertas.cuotaFinal ? 'bg-[var(--r2)]' : 'bg-[var(--fill)]'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                                      ${alertas.cuotaFinal ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--fill2)' }}>
                    <label className="block font-medium mb-2" style={{ color: 'var(--label)' }}>
                      Días de anticipación
                    </label>
                    <select
                      value={alertas.diasAntes || 3}
                      onChange={(e) => setAlertas({...alertas, diasAntes: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 rounded-xl border"
                      style={{
                        backgroundColor: 'var(--fill)',
                        borderColor: 'var(--sep)',
                        color: 'var(--label)'
                      }}
                    >
                      <option value={1}>1 día antes</option>
                      <option value={3}>3 días antes</option>
                      <option value={5}>5 días antes</option>
                      <option value={7}>7 días antes</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Importar/Exportar Datos */}
            {activeTab === 'datos' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--label)' }}>Importar / Exportar Datos</h3>

                {/* Exportar CSV */}
                <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: 'var(--fill2)' }}>
                  <p className="font-medium" style={{ color: 'var(--label)' }}>Exportar a CSV</p>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => exportarCSV('movimientos')}
                      className="px-4 py-3 rounded-xl border text-center transition-colors hover:bg-[var(--fill2)]"
                      style={{ borderColor: 'var(--sep)', color: 'var(--label)' }}
                    >
                      <FileText className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Movimientos</span>
                    </button>
                    <button
                      onClick={() => exportarCSV('cuotas')}
                      className="px-4 py-3 rounded-xl border text-center transition-colors hover:bg-[var(--fill2)]"
                      style={{ borderColor: 'var(--sep)', color: 'var(--label)' }}
                    >
                      <Calendar className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Cuotas</span>
                    </button>
                    <button
                      onClick={() => exportarCSV('resumenes')}
                      className="px-4 py-3 rounded-xl border text-center transition-colors hover:bg-[var(--fill2)]"
                      style={{ borderColor: 'var(--sep)', color: 'var(--label)' }}
                    >
                      <Receipt className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Resúmenes</span>
                    </button>
                  </div>
                </div>

                {/* Backup completo */}
                <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: 'var(--fill2)' }}>
                  <p className="font-medium" style={{ color: 'var(--label)' }}>Backup de Configuración</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleExportAll}
                      className="flex-1 px-4 py-3 rounded-xl bg-[var(--inv)] text-[var(--inv-text)] hover:opacity-90 transition-colors text-center"
                    >
                      <Download className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Exportar Todo</span>
                    </button>
                    <label className="flex-1 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center hover:border-[var(--label)]"
                           style={{ borderColor: 'var(--sep)', color: 'var(--label)' }}>
                      <Upload className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Importar</span>
                      <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Refrescar datos */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--fill2)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium" style={{ color: 'var(--label)' }}>Refrescar datos</p>
                      <p className="text-sm" style={{ color: 'var(--label2)' }}>Recargar todos los datos desde el servidor</p>
                    </div>
                    <button
                      onClick={() => { onRefreshData(); onClose(); }}
                      className="px-4 py-2 rounded-lg bg-[var(--inv)] text-[var(--inv-text)] text-sm font-medium hover:opacity-90"
                    >
                      <RefreshCcw className="w-4 h-4 inline mr-2" />
                      Refrescar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Apariencia (la misma que el menú Más) */}
            {activeTab === 'temas' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--label)' }}>Apariencia</h3>
                <div className="space-y-2">
                  <p className="text-sm" style={{ color: 'var(--label2)' }}>Modo de color</p>
                  <Seg
                    ariaLabel="Modo de color"
                    valor={apariencia?.modo}
                    onCambio={(modo) => onApariencia?.({ modo })}
                    opciones={[{ id: 'sistema', label: 'Sistema' }, { id: 'claro', label: 'Claro' }, { id: 'oscuro', label: 'Oscuro' }]}
                  />
                </div>
                <label className="flex items-center justify-between gap-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--fill2)' }}>
                  <span>
                    <span className="block font-medium" style={{ color: 'var(--label)' }}>Reducir transparencia</span>
                    <span className="block text-sm" style={{ color: 'var(--label2)' }}>Ventana, barra y menús opacos, sin el fondo de colores.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={!!apariencia?.reducirTransparencia}
                    onChange={(e) => onApariencia?.({ reducirTransparencia: e.target.checked })}
                    style={{ width: 22, height: 22, accentColor: 'var(--r2)' }}
                  />
                </label>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  // Apariencia (Sistema / Claro / Oscuro + Reducir transparencia + lado del riel).
  // storage.getConfig() la migra desde el 'tarjetas_theme' viejo la primera vez.
  const [apariencia, setApariencia] = useState(() => storage.getConfig().apariencia);
  const [sistemaOscuro, setSistemaOscuro] = useState(() => {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return true; }
  });
  const oscuro = modoEfectivo(apariencia.modo, sistemaOscuro) === 'oscuro';
  const cambiarApariencia = (cambios) => setApariencia(prev => ({ ...prev, ...cambios }));
  const [activeView, setActiveView] = useState('dashboard');
  const [pendientesNombre, setPendientesNombre] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('tarjetas');

  // Onboarding state - mostrar solo si es la primera vez
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('onboarding_completed');
  });

  // Novedades: una vez por versión. Quien recién instala ya ve el onboarding, así
  // que no se le muestran novedades de algo que nunca usó.
  const [mostrarNovedades, setMostrarNovedades] = useState(() => {
    try {
      if (!localStorage.getItem('onboarding_completed')) return false;
      return localStorage.getItem('novedades_version_vista') !== APP_VERSION;
    } catch { return false; }
  });
  const cerrarNovedades = (irAGuia = false) => {
    try { localStorage.setItem('novedades_version_vista', APP_VERSION); } catch {}
    setMostrarNovedades(false);
    if (irAGuia) setActiveView('guia');
  };

  const handleOnboardingComplete = () => {
    try { localStorage.setItem('novedades_version_vista', APP_VERSION); } catch {}
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);
    // Ir directamente a la vista de importar
    setActiveView('importar');
  };
  
  // Data states
  const [tarjetas, setTarjetas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [resumenes, setResumenes] = useState([]);
  const [cuotasActivas, setCuotasActivas] = useState([]);
  const [reglas, setReglas] = useState([]);
  const [consumosLive, setConsumosLive] = useState(() => storage.getConsumosLive());
  const [ciclosLive, setCiclosLive] = useState(() => storage.getCiclosLive());
  const refrescarLive = () => { setConsumosLive(storage.getConsumosLive()); setCiclosLive(storage.getCiclosLive()); };
  const [loading, setLoading] = useState(true);

  // Cotización USD
  const [cotizacion, setCotizacion] = useState(() => {
    try {
      const cache = JSON.parse(localStorage.getItem('cotizacion_cache') || 'null');
      if (cache && Date.now() - cache.cachedAt < 30 * 60 * 1000) return cache;
    } catch {}
    return null;
  });

  // Estado para gastos fijos/variables (calculado de los movimientos)
  const [gastosFijos, setGastosFijos] = useState(new Set());
  const [gastosFijosDetalle, setGastosFijosDetalle] = useState({ ars: 0, usd: 0, items: [] });
  // Tipo de cada movimiento: { [mov.id]: { tipo: 'fijo'|'variable', origen: 'auto'|'manual' } }
  const [tiposGasto, setTiposGasto] = useState({});
  // Preguntas pendientes sobre gastos fijos que faltan en el último resumen
  const [preguntasFijos, setPreguntasFijos] = useState([]);

  // Nombres personalizados de tarjetas (guardados en localStorage)
  const [nombresTarjetas, setNombresTarjetas] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('nombresTarjetas') || '{}');
    } catch { return {}; }
  });

  // Función para guardar nombre personalizado de tarjeta
  const guardarNombreTarjeta = async (tarjetaId, nuevoNombre) => {
    const nuevosNombres = { ...nombresTarjetas, [tarjetaId]: nuevoNombre };
    setNombresTarjetas(nuevosNombres);
    localStorage.setItem('nombresTarjetas', JSON.stringify(nuevosNombres));
    // Las tarjetas que solo existen por Últimos consumos no están en el backend.
    if (String(tarjetaId).startsWith('live:')) return;

    // También guardar en el backend si está disponible
    try {
      await fetch(`${API_BASE}/tarjetas/${tarjetaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_personalizado: nuevoNombre })
      });
    } catch (e) {
      // Silently fail
    }
  };

  // Handlers de consumos live (pre-resumen)
  const handleDeleteConsumosLive = (tarjeta = null) => {
    storage.deleteConsumosLive(tarjeta);
    refrescarLive();
  };

  // Renombrar un comercio. La regla se guarda por CLAVE DE COMERCIO (la descripción
  // del banco sin los códigos que cambian cada mes), así el nombre nuevo se aplica a
  // todos los meses —pasados y futuros— de ese comercio. El nombre es solo lo que se
  // ve: el tipo fijo/variable se calcula por ID de movimiento y no cambia.
  const guardarEdicionDescripcion = async (mov, nombreLimpio) => {
    const clave = claveComercio(mov.referencia_original);
    if (!clave) return;

    // 1. Reemplazar una regla previa de la misma clave (si la hay)
    storage.getReglas()
      .filter(r => r.es_clave && r.patron === clave)
      .forEach(r => storage.deleteRegla(r.id));
    storage.saveRegla({
      patron: clave,
      nombre_limpio: nombreLimpio,
      es_clave: true,
      referencia_original: mov.referencia_original,
      fecha_creacion: new Date().toISOString()
    });

    // 2. Persistir el nombre en los movimientos de esa clave
    const actualizados = storage.getMovimientos().map(m =>
      claveComercio(m.referencia_original) === clave ? { ...m, referencia_limpia: nombreLimpio } : m
    );
    storage.setItem('tarjetas_movimientos', actualizados);

    // 3. Recalcular todo (incluye gastos fijos) desde localStorage
    await fetchData();

    // 4. Sincronizar con backend para futuras importaciones (regex equivalente a la clave)
    try {
      await fetch(`${API_BASE}/reglas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patron: regexDeClave(clave),
          es_regex: true,
          nombre_limpio: nombreLimpio,
          referencia_original: mov.referencia_original
        })
      });
    } catch (e) {
      // Silently fail - backend sync is optional
    }
  };

  // Período ('YYYY-MM') del resumen de un movimiento.
  const periodoDeMov = (mov) => {
    const r = resumenes.find(x => x.id === mov.resumen_id);
    return periodoDeMovimiento(mov, r ? { [r.id]: `${r.anio}-${String(r.mes).padStart(2, '0')}` } : {});
  };

  // Cambio manual del tipo de gasto. Vale desde el resumen de ese movimiento hacia
  // adelante, para toda su serie, y el detector ya no lo toca. Para aplicarlo desde
  // antes, el usuario lo cambia en un resumen anterior.
  const cambiarTipoGasto = async (mov, tipo) => {
    const actual = tiposGasto[mov.id];
    if (actual?.tipo === tipo) return;
    storage.saveTipoOverride({
      mov_id: mov.id,
      tipo,
      desde: periodoDeMov(mov),
      tipo_previo: actual?.tipo || 'variable',
      origen_previo: actual?.origen || 'auto'
    });
    // Métrica: cada cambio sobre un tipo AUTOMÁTICO es un error del detector.
    if (!actual || actual.origen === 'auto') {
      storage.registrarMetrica('correcciones');
      storage.registrarMetrica(tipo === 'fijo' ? 'a_fijo' : 'a_variable');
    }
    await fetchData();
  };

  // Respuesta a una pregunta sobre un gasto fijo que falta en el último resumen.
  // Devuelve los ids de las decisiones guardadas, para poder deshacerlas desde Mes.
  const responderPreguntaFijo = async (pregunta, respuesta) => {
    const base = { mov_id: pregunta.ultimo.mov_id, periodo: pregunta.periodo };
    const ids = [];
    const guardar = (d) => ids.push(storage.saveDecisionFijo(d));
    if (respuesta === 'mismo') {
      guardar({ tipo: 'enlace', mov_id: pregunta.candidato.mov_id, prev_id: pregunta.ultimo.mov_id, periodo: pregunta.periodo });
      guardar({ tipo: 'respondida', ...base });
    } else if (respuesta === 'otro') {
      // No es el mismo: se prohíbe ese enlace; si sigue faltando, se pregunta si se dio de baja.
      guardar({ tipo: 'no_enlace', mov_id: pregunta.candidato.mov_id, prev_id: pregunta.ultimo.mov_id });
    } else if (respuesta === 'baja') {
      guardar({ tipo: 'baja', ...base });
    } else if (respuesta === 'sigue') {
      guardar({ tipo: 'sigue', ...base });
    } else {
      guardar({ tipo: 'omitida', ...base });
    }
    if (respuesta !== 'omitir') storage.registrarMetrica('preguntas_respondidas');
    await fetchData();
    return ids.filter(Boolean);
  };

  // Deshacer una respuesta: se sacan sus decisiones y se recalculan las series.
  const deshacerPreguntaFijo = async (ids = []) => {
    ids.forEach(id => storage.removeDecisionFijo(id));
    await fetchData();
  };

  // 'Sistema' sigue al sistema operativo en vivo.
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return undefined; }
    const onChange = (e) => setSistemaOscuro(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Las clases .tj/.claro/.rt van en <html> para que modales y portales las hereden.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.remove('tj', 'claro', 'rt');
    raiz.classList.add(...clasesApariencia(apariencia, sistemaOscuro));
    raiz.removeAttribute('data-theme');
  }, [apariencia, sistemaOscuro]);

  useEffect(() => {
    storage.saveConfig({ apariencia });
  }, [apariencia]);

  // Reglas de nombres: los pendientes viven en el backend (RAM). Sin backend, lista vacía.
  const cargarPendientesNombre = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pendientes-nombre`);
      const json = await res.json();
      setPendientesNombre(json.data || []);
    } catch {
      setPendientesNombre([]);
    }
  }, []);

  useEffect(() => {
    if (activeView === 'reglas') cargarPendientesNombre();
  }, [activeView, cargarPendientesNombre]);

  // Fetch all data from localStorage
  // Cotizacion usada para pesificar cuotas en dolares. Es una dependencia real de
  // fetchData: cuando llega la cotizacion, la proyeccion se recalcula una vez.
  const cotizacionVenta = cotizacion?.venta || 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Función para detectar banco desde nombre de tarjeta
      const detectarBanco = (nombre) => {
        const n = (nombre || '').toUpperCase();
        if (n.includes('GALICIA')) return 'Galicia';
        if (n.includes('MACRO')) return 'Macro';
        if (n.includes('SANTANDER')) return 'Santander';
        if (n.includes('BBVA')) return 'BBVA';
        if (n.includes('HSBC')) return 'HSBC';
        if (n.includes('ICBC')) return 'ICBC';
        if (n.includes('CIUDAD')) return 'Ciudad';
        if (n.includes('NACION') || n.includes('NACIÓN')) return 'Nación';
        if (n.includes('PROVINCIA')) return 'Provincia';
        if (n.includes('PATAGONIA')) return 'Patagonia';
        if (n.includes('SUPERVIELLE')) return 'Supervielle';
        if (n.includes('BRUBANK')) return 'Brubank';
        if (n.includes('UALA') || n.includes('UALÁ')) return 'Ualá';
        if (n.includes('MERCADOPAGO') || n.includes('MERCADO PAGO')) return 'Mercado Pago';
        return null;
      };

      // Función para detectar tipo de tarjeta
      const detectarTipo = (nombre) => {
        const n = (nombre || '').toUpperCase();
        // AMEX primero porque "AMERICAN EXPRESS" no contiene "VISA"
        if (n.includes('AMEX') || n.includes('AMERICAN')) return 'AMEX';
        if (n.includes('MASTERCARD')) return 'MASTERCARD';
        if (n.includes('VISA')) return 'VISA';
        if (n.includes('CABAL')) return 'CABAL';
        if (n.includes('NARANJA')) return 'NARANJA';
        return 'VISA';
      };

      // Leer datos de localStorage
      const resumenesData = storage.getResumenes();
      let movimientosData = storage.getMovimientos();
      let tarjetasData = storage.getTarjetas();
      const reglasLocales = storage.getReglas();

      // Aplicar reglas locales a los movimientos
      if (reglasLocales.length > 0) {
        // Reglas por clave de comercio (las crea el usuario al renombrar): valen para
        // todos los meses, aunque el banco cambie el código de factura. Tienen
        // prioridad sobre las reglas viejas; entre ellas gana la más reciente.
        const reglasClave = reglasLocales
          .filter(r => r.es_clave)
          .sort((a, b) => String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || '')));
        movimientosData = movimientosData.map(m => {
          if (reglasClave.length) {
            const clave = claveComercio(m.referencia_original);
            const rc = clave && reglasClave.find(r => r.patron === clave);
            if (rc) return { ...m, referencia_limpia: rc.nombre_limpio };
          }
          // Buscar si hay una regla que coincida con la referencia_original
          const regla = reglasLocales.find(r => {
            if (r.es_clave) return false;
            if (r.es_exacta) {
              // Coincidencia exacta
              return r.patron === m.referencia_original;
            } else {
              // Coincidencia por regex/patrón
              try {
                const regex = new RegExp(r.patron, 'i');
                return regex.test(m.referencia_original);
              } catch {
                return r.patron.toLowerCase() === m.referencia_original.toLowerCase();
              }
            }
          });
          if (regla) {
            return { ...m, referencia_limpia: regla.nombre_limpio };
          }
          return m;
        });
      }

      // Corregir tarjetas con banco Desconocido o tipo incorrecto
      let tarjetasActualizadas = false;
      tarjetasData = tarjetasData.map(t => {
        const bancoDet = detectarBanco(t.nombre);
        const tipoDet = detectarTipo(t.nombre);
        const necesitaCorreccion =
          (!t.banco || t.banco === 'Desconocido' || (bancoDet && t.banco !== bancoDet)) ||
          (!t.tipo || t.tipo !== tipoDet);

        if (necesitaCorreccion) {
          tarjetasActualizadas = true;
          return {
            ...t,
            banco: bancoDet || t.banco || 'Desconocido',
            tipo: tipoDet
          };
        }
        return t;
      });
      if (tarjetasActualizadas) {
        localStorage.setItem('tarjetas_lista', JSON.stringify(tarjetasData));
      }

      // ── Planes de cuotas ────────────────────────────────────────────────────
      // Toda la lógica vive en services/cuotas.js (única fuente de verdad, testeada
      // con `npm test` en Frontend). Un plan se arma con TODOS los resúmenes y queda
      // anclado al período donde se lo vio por última vez; si un resumen posterior de
      // esa tarjeta no lo factura, viene marcado como `interrumpida`.
      // Las decisiones del usuario sobre planes 'a revisar' (fase 5) entran acá: así
      // cambian Cuotas, la proyección, Mes y el gráfico a la vez.
      const cuotasActivasData = construirPlanes(movimientosData, resumenesData, storage.getDecisionesPlanes());

      // Tarjetas con su último resumen (lo usa el campo de luz para el peso de cada mancha).
      const tarjetasEnriquecidas = tarjetasData.map((t, idx) => {
        const ultimoResumen = resumenesData
          .filter(r => r.tarjeta === t.nombre)
          .sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes))[0] || null;
        return {
          ...t,
          id: t.id || idx + 1, // Asegurar que tenga ID
          ultimo_resumen: ultimoResumen ? {
            total_a_pagar: ultimoResumen.total_a_pagar_pesos,
            total_a_pagar_dolares: ultimoResumen.total_a_pagar_dolares || 0,
            fecha_cierre: ultimoResumen.fecha_cierre,
            fecha_vencimiento: ultimoResumen.fecha_vencimiento,
            mes: ultimoResumen.mes,
            anio: ultimoResumen.anio
          } : null
        };
      });

      // Transformar cuotas al formato esperado por CuotasView
      const cuotasFormateadas = formatearParaVista(cuotasActivasData);

      setTarjetas(tarjetasEnriquecidas);
      setMovimientos(movimientosData);
      setResumenes(resumenesData);
      setCuotasActivas(cuotasFormateadas);

      // Gastos fijos vs variables (services/series.js): cadenas por ID de movimiento,
      // luego los cambios manuales del usuario (desde su resumen hacia adelante).
      const decisionesFijos = storage.getDecisionesFijos();
      const series = construirCadenas(movimientosData, resumenesData, decisionesFijos);
      const { tipos, fijos: fijosSet } = aplicarOverrides(movimientosData, series, storage.getTipoOverrides());
      setGastosFijos(fijosSet);
      setTiposGasto(tipos);
      setGastosFijosDetalle(resumenFijos(series, tipos));
      setPreguntasFijos(preguntasPendientes(series, tipos, resumenesData, decisionesFijos));
      setReglas(reglasLocales);

    } catch (error) {
      console.error('[App] Error loading data:', error);
    }
    setLoading(false);
  }, [cotizacionVenta]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch cotización dólar tarjeta (cache 30 min)
  useEffect(() => {
    const cached = (() => {
      try {
        const c = JSON.parse(localStorage.getItem('cotizacion_cache') || 'null');
        return c && Date.now() - c.cachedAt < 30 * 60 * 1000 ? c : null;
      } catch { return null; }
    })();
    if (cached) return;

    fetch('https://dolarapi.com/v1/dolares/tarjeta')
      .then(r => r.json())
      .then(data => {
        const entry = {
          venta: data.venta,
          compra: data.compra,
          nombre: data.nombre || 'Tarjeta',
          fechaActualizacion: data.fechaActualizacion,
          cachedAt: Date.now()
        };
        localStorage.setItem('cotizacion_cache', JSON.stringify(entry));
        setCotizacion(entry);
      })
      .catch(() => {
        // Fallback a bluelytics
        fetch('https://api.bluelytics.com.ar/v2/latest')
          .then(r => r.json())
          .then(data => {
            const entry = {
              venta: data.oficial?.value_sell,
              compra: data.oficial?.value_buy,
              nombre: 'Oficial',
              fechaActualizacion: data.last_update,
              cachedAt: Date.now()
            };
            localStorage.setItem('cotizacion_cache', JSON.stringify(entry));
            setCotizacion(entry);
          })
          .catch(() => {});
      });
  }, []);

  // Calcular reintegros. Se marca cuáles caen en el último resumen de su tarjeta:
  // la vista muestra esos por defecto, el histórico queda detrás de un botón.
  const ultimoPeriodoPorTarjeta = useMemo(() => {
    const acc = {};
    resumenes.forEach(r => {
      if (!r?.tarjeta || !r.anio || !r.mes) return;
      const periodo = r.anio * 12 + (r.mes - 1);
      if (acc[r.tarjeta] === undefined || periodo > acc[r.tarjeta]) acc[r.tarjeta] = periodo;
    });
    return acc;
  }, [resumenes]);

  const periodoPorResumenId = useMemo(() => Object.fromEntries(
    resumenes.filter(r => r?.id && r.anio && r.mes).map(r => [r.id, r.anio * 12 + (r.mes - 1)])
  ), [resumenes]);

  const reintegros = useMemo(() => movimientos
    .filter(m =>
      m.monto_pesos < 0 ||
      m.monto_dolares < 0 ||
      /reintegro|devoluci[oó]n|cr[eé]dito|bonificaci[oó]n/i.test(m.referencia_original || m.referencia_limpia || '')
    )
    .map(m => {
      // El período sale del resumen; si el movimiento es viejo y no trae resumen_id,
      // se cae a anio_resumen/mes_resumen.
      const periodo = periodoPorResumenId[m.resumen_id]
        ?? (m.anio_resumen && m.mes_resumen ? m.anio_resumen * 12 + (m.mes_resumen - 1) : null);
      const ultimo = ultimoPeriodoPorTarjeta[m.tarjeta];
      // Sin período no se puede ubicar: se trata como reciente para no esconderlo.
      return { ...m, es_reciente: periodo === null || ultimo === undefined || periodo === ultimo };
    }), [movimientos, periodoPorResumenId, ultimoPeriodoPorTarjeta]);

  // Período más reciente cargado, para rotular la vista de Reintegros.
  const periodoRecienteLabel = useMemo(() => {
    const max = Math.max(...Object.values(ultimoPeriodoPorTarjeta), -Infinity);
    if (!isFinite(max)) return null;
    return new Date(Math.floor(max / 12), max % 12, 1)
      .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }, [ultimoPeriodoPorTarjeta]);

  // Navegación del rediseño: 4 secciones principales + menú Más.
  // activeView sigue siendo la fuente de verdad; solo cambia cómo se llega a cada vista.
  const VISTA_DE_SECCION = { mes: 'dashboard', tarjetas: 'tarjetas', movimientos: 'movimientos', cuotas: 'cuotas' };
  const SECCION_DE_VISTA = { dashboard: 'mes', tarjetas: 'tarjetas', movimientos: 'movimientos', cuotas: 'cuotas' };
  const seccionActual = SECCION_DE_VISTA[activeView] || 'otra';
  const TITULOS = {
    dashboard: 'Mes', tarjetas: 'Tarjetas', movimientos: 'Movimientos', cuotas: 'Cuotas',
    'consumos-live': 'Últimos consumos', reintegros: 'Reintegros', reglas: 'Reglas de nombres',
    importar: 'Importar', guia: 'Guía y novedades'
  };

  const menuMas = [
    { tipo: 'item', id: 'ajustes', label: 'Ajustes', onSelect: () => setSettingsOpen(true) },
    { tipo: 'item', id: 'consumos-live', label: 'Últimos consumos', onSelect: () => setActiveView('consumos-live') },
    { tipo: 'item', id: 'reglas', label: 'Reglas de nombres', onSelect: () => setActiveView('reglas') },
    { tipo: 'item', id: 'guia', label: 'Guía y novedades', onSelect: () => setActiveView('guia') },
    { tipo: 'sep' },
    { tipo: 'titulo', label: 'Apariencia' },
    { tipo: 'radio', id: 'modo-sistema', label: 'Sistema', checked: apariencia.modo === 'sistema', onSelect: () => cambiarApariencia({ modo: 'sistema' }) },
    { tipo: 'radio', id: 'modo-claro', label: 'Claro', checked: apariencia.modo === 'claro', onSelect: () => cambiarApariencia({ modo: 'claro' }) },
    { tipo: 'radio', id: 'modo-oscuro', label: 'Oscuro', checked: apariencia.modo === 'oscuro', onSelect: () => cambiarApariencia({ modo: 'oscuro' }) },
    { tipo: 'sep' },
    { tipo: 'check', id: 'rt', label: 'Reducir transparencia', checked: apariencia.reducirTransparencia, onSelect: () => cambiarApariencia({ reducirTransparencia: !apariencia.reducirTransparencia }) },
    { tipo: 'check', id: 'rail-izq', label: 'Menú a la izquierda', checked: apariencia.railIzquierda, onSelect: () => cambiarApariencia({ railIzquierda: !apariencia.railIzquierda }), soloCelular: true }
  ];

  // Campo de luz: una mancha por tarjeta (orden de alta), escala según su último total a pagar.
  const manchas = manchasDeLuz(
    tarjetas.map(t => ({ tarjeta: t, peso: t.ultimo_resumen?.total_a_pagar || 0 })),
    { oscuro }
  );

  // ===== Sección Mes (services/mes.js) =====
  const [tope, setTope] = useState(() => storage.getConfig().tope_mensual ?? null);
  const [tarjetaElegida, setTarjetaElegida] = useState(null); // la usa la sección Tarjetas (fase 3)
  const guardarTope = (valor) => {
    setTope(valor);
    storage.saveConfig({ tope_mensual: valor });
  };

  const mes = useMemo(() => {
    const desfase = desfasePorTarjeta(resumenes);
    const ciclo = cicloDePago({ tarjetas, resumenes, ciclosLive, consumosLive });
    const conDatos = ciclo.porTarjeta.filter(t => t.fuente !== 'sin_datos').map(t => t.tarjetaId);
    const cuotas = cuotasDelMes(cuotasActivas, ciclo.mesKey, { desfase, cotizacionVenta, tarjetas: conDatos });
    const fijosArs = gastosFijosDetalle?.ars || 0;
    const fijosUsd = gastosFijosDetalle?.usd || 0;
    // Fase 3: la composición del mes es la suma de "Esta tarjeta en el mes" de cada tarjeta.
    const porTarjetaComp = composicionPorTarjeta({
      porTarjeta: ciclo.porTarjeta, cuotas: cuotas.items, fijosPorTarjeta: fijosPorTarjeta(gastosFijosDetalle?.items)
    });
    const comp = composicionDesdeTarjetas(porTarjetaComp, { porTarjeta: ciclo.porTarjeta, fijosUsd });

    const mesSiguiente = sumarMeses(ciclo.mesKey, 1);
    const siguiente = cicloDePago({ tarjetas, resumenes, ciclosLive, consumosLive, mesKey: mesSiguiente });
    const cuotasProx = cuotasDelMes(cuotasActivas, mesSiguiente, { desfase, cotizacionVenta });
    const cuotasPorTarjeta = {};
    cuotasProx.items.forEach(i => { if (!i.es_estimado_usd) cuotasPorTarjeta[i.tarjeta] = (cuotasPorTarjeta[i.tarjeta] || 0) + i.monto; });
    const prox = proximoMes({ cuotasDelMes: cuotasProx.total, fijosArs, fijosUsd, porTarjetaSiguiente: siguiente.porTarjeta, cuotasPorTarjeta });
    return { ciclo, comp, porTarjetaComp, cuotas, siguiente, cuotasProx, prox, desfase };
  }, [tarjetas, resumenes, ciclosLive, consumosLive, cuotasActivas, cotizacionVenta, gastosFijosDetalle]);

  // Evolución y proyección (fase 2): 12 pagados + en curso + 6 comprometidos.
  const evolucion = useMemo(() => {
    const opts = { desfase: mes.desfase, cotizacionVenta };
    const columnas = serieEvolucion({
      resumenes, movimientos, tipos: tiposGasto, planes: cuotasActivas, fijos: gastosFijosDetalle,
      ciclo: mes.ciclo, composicion: mes.comp, porTarjetaComp: mes.porTarjetaComp, ...opts
    });
    const detalles = Object.fromEntries(columnas
      .filter(c => c.tipo === 'comprometido')
      .map(c => [c.mesKey, detalleMes(c, cuotasActivas, opts)]));
    return { columnas, detalles };
  }, [mes, resumenes, movimientos, tiposGasto, cuotasActivas, gastosFijosDetalle, cotizacionVenta]);

  // Nombres personalizados en todas las vistas (fase 6).
  const nombreDe = (id, fallback) => nombreVisible(id, { tarjetas, nombres: nombresTarjetas, fallback });
  // Una tarjeta que solo existía por Últimos consumos y ahora tiene resumen: su nombre
  // ('live:<grupoKey>') pasa a la clave de la tarjeta.
  useEffect(() => {
    const migrados = migrarNombresLive(nombresTarjetas, { tarjetas, ciclosLive });
    if (migrados !== nombresTarjetas) {
      setNombresTarjetas(migrados);
      try { localStorage.setItem('nombresTarjetas', JSON.stringify(migrados)); } catch { /* sin storage */ }
    }
  }, [tarjetas, ciclosLive, nombresTarjetas]);

  // ===== Sección Tarjetas (fase 3) =====
  const listaTarjetas = useMemo(
    () => armarTarjetas({ tarjetas, resumenes, ciclosLive, consumosLive }),
    [tarjetas, resumenes, ciclosLive, consumosLive]
  );
  // Para abrir Movimientos ya filtrado desde otra vista: { tarjeta?, tipo?, n }
  const [movimientosFiltro, setMovimientosFiltro] = useState(null);
  // Plan elegido al entrar a Cuotas desde un movimiento ("Ver plan en Cuotas"); lo usa la fase 5.
  const [planElegido, setPlanElegido] = useState(null);
  useEffect(() => { if (activeView !== 'cuotas') setPlanElegido(null); }, [activeView]);
  const [decisionesPlanes, setDecisionesPlanes] = useState(() => storage.getDecisionesPlanes());
  const decidirPlan = async (plan, decision) => {
    const id = storage.addDecisionPlan({ claveDePlan: plan.clave, decision });
    setDecisionesPlanes(storage.getDecisionesPlanes());
    await fetchData();
    return id;
  };
  const deshacerDecisionPlan = async (id) => {
    storage.removeDecisionPlan(id);
    setDecisionesPlanes(storage.getDecisionesPlanes());
    await fetchData();
  };
  // Reintegros ya no es una vista: es un filtro de Movimientos.
  useEffect(() => {
    if (activeView === 'reintegros') {
      setMovimientosFiltro({ tipo: 'reintegros', n: Date.now() });
      setActiveView('movimientos');
    }
  }, [activeView]);
  // La tarjeta elegida tiñe el fondo.
  const elegidaLuz = activeView === 'tarjetas' ? buscarTarjeta(listaTarjetas, tarjetaElegida)?.id : null;
  const manchasVista = manchasElegida(manchas, elegidaLuz);

  // Mostrar Onboarding si es la primera vez
  if (showOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <AppShell
        seccion={seccionActual}
        onSeccion={(id) => setActiveView(VISTA_DE_SECCION[id])}
        onImportar={() => setActiveView('importar')}
        busqueda={searchQuery}
        onBuscar={(q) => {
          setSearchQuery(q);
          // Mes y Tarjetas no filtran: la búsqueda global se ve en Movimientos.
          if (q && (activeView === 'dashboard' || activeView === 'tarjetas')) setActiveView('movimientos');
        }}
        menu={menuMas}
        manchas={manchasVista}
        railIzquierda={apariencia.railIzquierda}
        titulo={['dashboard', 'movimientos', 'cuotas'].includes(activeView) ? null : TITULOS[activeView]}
        subtitulo={(() => {
          const f = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
          return f.charAt(0).toUpperCase() + f.slice(1);
        })()}
      >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--r2)] border-t-transparent" />
            </div>
          ) : activeView === 'dashboard' ? (
            <MesView
              ciclo={mes.ciclo}
              composicion={mes.comp}
              proximo={mes.prox}
              planesDelMes={mes.cuotas.items}
              planesProximo={mes.cuotasProx.items}
              porTarjetaProximo={mes.siguiente.porTarjeta}
              fijos={gastosFijosDetalle}
              preguntas={preguntasFijos}
              onResponderPregunta={responderPreguntaFijo}
              onDeshacerPregunta={deshacerPreguntaFijo}
              tope={tope}
              onTope={guardarTope}
              onAbrirTarjeta={(id) => { setTarjetaElegida(id); setActiveView('tarjetas'); }}
              onImportar={() => setActiveView('importar')}
              tarjetas={tarjetas}
              oscuro={oscuro}
              evolucion={evolucion}
              nombreDe={nombreDe}
            />
          ) : activeView === 'tarjetas' ? (
            <TarjetasView
              lista={listaTarjetas}
              tarjetas={tarjetas}
              elegida={tarjetaElegida}
              onElegir={setTarjetaElegida}
              composicionPorTarjeta={mes.porTarjetaComp}
              mesKey={mes.ciclo.mesKey}
              totalMes={mes.comp.total}
              cuotasProximo={mes.cuotasProx}
              planes={cuotasActivas}
              movimientos={movimientos}
              consumosLive={consumosLive}
              historial={evolucion.columnas}
              cotizacion={cotizacion}
              nombresTarjetas={nombresTarjetas}
              onGuardarNombre={guardarNombreTarjeta}
              onAsignarBanco={(grupoKey, banco) => { guardarBanco(grupoKey, banco); refrescarLive(); }}
              bancos={BANCOS_COMUNES}
              resumenes={resumenes}
              onDeleteResumen={async (r) => { storage.deleteResumen(r.id); await fetchData(); }}
              onVerMovimientos={(t) => {
                if (t.tarjeta) {
                  setMovimientosFiltro({ tarjeta: t.tarjeta.nombre, n: Date.now() });
                  setActiveView('movimientos');
                } else {
                  setActiveView('consumos-live'); // grupo sin resúmenes: sus consumos viven ahí
                }
              }}
              oscuro={oscuro}
            />
          ) : activeView === 'movimientos' ? (
            <MovimientosView
              movimientos={movimientos}
              tarjetas={tarjetas}
              resumenes={resumenes}
              reintegros={reintegros}
              periodoRecienteLabel={periodoRecienteLabel}
              gastosFijos={gastosFijos}
              planes={cuotasActivas}
              preguntas={preguntasFijos}
              busqueda={searchQuery}
              onBuscar={setSearchQuery}
              onEditarDescripcion={guardarEdicionDescripcion}
              onCambiarTipo={cambiarTipoGasto}
              onVerPlan={(plan) => { setPlanElegido(plan.id); setActiveView('cuotas'); }}
              filtro={movimientosFiltro}
              nombresTarjetas={nombresTarjetas}
              oscuro={oscuro}
            />
          ) : activeView === 'consumos-live' ? (
            <ConsumosLiveView
              consumosLive={consumosLive}
              tarjetas={tarjetas}
              resumenes={resumenes}
              onDeleteConsumos={handleDeleteConsumosLive}
              onIrAImportar={() => setActiveView('importar')}
            />
          ) : activeView === 'cuotas' ? (
            <CuotasView
              planes={cuotasActivas}
              hoyMesKey={mes.ciclo.mesKey}
              desfase={mes.desfase}
              cotizacionVenta={cotizacionVenta}
              tarjetas={tarjetas}
              nombresTarjetas={nombresTarjetas}
              busqueda={searchQuery}
              planElegido={planElegido}
              decisiones={decisionesPlanes}
              onDecidir={decidirPlan}
              onDeshacer={deshacerDecisionPlan}
              oscuro={oscuro}
            />
          ) : activeView === 'reglas' ? (
            <ReglasView
              reglas={reglas}
              pendientes={pendientesNombre}
              searchQuery={searchQuery}
              onRefresh={() => { cargarPendientesNombre(); fetchData(); }}
            />
          ) : activeView === 'guia' ? (
            <GuiaView onVerNovedades={() => setMostrarNovedades(true)} />
          ) : activeView === 'importar' ? (
            <ImportarView onSuccess={() => { refrescarLive(); fetchData(); }} preguntasFijos={preguntasFijos} onResponderPregunta={responderPreguntaFijo} />
          ) : null}
      </AppShell>

      {mostrarNovedades && <NovedadesModal onCerrar={cerrarNovedades} />}

      {/* Modal de Configuración - Fuera del flujo principal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsInitialTab('tarjetas'); // Reset al cerrar
        }}
        tarjetas={tarjetas}
        reglas={reglas}
        movimientos={movimientos}
        resumenes={resumenes}
        cuotasActivas={cuotasActivas}
        onRefreshData={fetchData}
        apariencia={apariencia}
        onApariencia={cambiarApariencia}
        initialTab={settingsInitialTab}
      />
    </>
  );
};

/**
 * Preguntas sobre gastos fijos que faltan en el último resumen. Una sola tarjeta con
 * todas juntas, un toque por respuesta. Si el usuario no responde, la app decide
 * sola (sin cargo 2 resúmenes seguidos => finalizado).
 */
const PreguntasFijosCard = ({ preguntas = [], onResponder }) => {
  const [enviando, setEnviando] = useState(null);
  if (!preguntas.length || !onResponder) return null;

  const monto = (valor, moneda) => moneda === 'USD' ? formatMontoDolares(valor) : formatMonto(valor);
  const mesLabel = (periodo) => {
    const [a, m] = String(periodo).split('-').map(Number);
    return new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  };
  const responder = async (p, respuesta) => {
    setEnviando(p.id);
    try { await onResponder(p, respuesta); } finally { setEnviando(null); }
  };
  const boton = (p, respuesta, label, primario = false) => (
    <button
      type="button"
      disabled={enviando === p.id}
      onClick={() => responder(p, respuesta)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${primario
        ? 'bg-[var(--inv)] text-[var(--inv-text)]'
        : 'bg-[var(--fill2)] border border-[var(--sep)] text-[var(--label)] hover:border-[var(--label)]'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="glass-card p-5 border-l-4 border-l-[var(--r2)]">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-5 h-5 text-[var(--r2)]" />
        <h3 className="font-semibold text-[var(--label)]">
          Revisá {preguntas.length === 1 ? 'un gasto fijo' : `${preguntas.length} gastos fijos`}
        </h3>
      </div>
      <div className="space-y-3">
        {preguntas.map(p => (
          <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-xl bg-[var(--fill2)]">
            <p className="flex-1 text-sm text-[var(--label2)]">
              {p.tipo === 'cambio_monto' ? (
                <>
                  <span className="font-semibold text-[var(--label)]">{p.nombre}</span> pasó de{' '}
                  {monto(p.ultimo.monto, p.moneda)} a <span className="font-semibold text-[var(--label)]">
                  {monto(p.candidato.monto, p.moneda)}</span> ({p.tarjeta}, {mesLabel(p.periodo)}). ¿Es el mismo gasto?
                </>
              ) : (
                <>
                  No encontramos <span className="font-semibold text-[var(--label)]">{p.nombre}</span> en
                  el resumen de {mesLabel(p.periodo)} ({p.tarjeta}). ¿Lo diste de baja?
                </>
              )}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {p.tipo === 'cambio_monto' ? (
                <>
                  {boton(p, 'mismo', 'Sí, cambió el precio', true)}
                  {boton(p, 'otro', 'No, es otro')}
                </>
              ) : (
                <>
                  {boton(p, 'baja', 'Sí, lo di de baja', true)}
                  {boton(p, 'sigue', 'No, sigue')}
                </>
              )}
              <button
                type="button"
                onClick={() => responder(p, 'omitir')}
                className="p-1.5 rounded-lg text-[var(--label2)] hover:text-[var(--label)]"
                title="Omitir: la app decide sola"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== Novedades y Guía ====================
// NovedadesModal y GuiaView → views/Guia.jsx (fase 6).

// MovimientosView se mudó a views/MovimientosView.jsx (fase 4).

// CuotasView se mudó a views/CuotasView.jsx (fase 5).

// Reglas View con funcionalidad de pendientes
const ReglasView = ({ reglas, pendientes, onRefresh, searchQuery = '' }) => {
  const [editingId, setEditingId] = useState(null);
  const [nombreLimpio, setNombreLimpio] = useState('');
  const [loading, setLoading] = useState(false);

  // Filtrar y deduplicar reglas
  const query = searchQuery.toLowerCase();
  const reglasUnicas = reglas.reduce((acc, regla) => {
    const key = `${regla.patron}-${regla.nombre_limpio}`;
    if (!acc.map[key]) {
      acc.map[key] = true;
      acc.list.push(regla);
    }
    return acc;
  }, { map: {}, list: [] }).list;

  const filteredReglas = reglasUnicas.filter(r => {
    if (!query) return true;
    return r.patron?.toLowerCase().includes(query) ||
           r.nombre_limpio?.toLowerCase().includes(query);
  });

  const filteredPendientes = pendientes.filter(p => {
    if (!query) return true;
    return p.referencia_original?.toLowerCase().includes(query) ||
           p.sugerencias?.some(s => s.toLowerCase().includes(query));
  });

  const handleResolver = async (id) => {
    if (!nombreLimpio.trim()) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/pendientes-nombre/${id}/resolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_limpio: nombreLimpio.trim() })
      });
      setEditingId(null);
      setNombreLimpio('');
      onRefresh?.();
    } catch (error) {
      console.error('Error resolviendo pendiente:', error);
    }
    setLoading(false);
  };

  const handleIgnorar = async (id) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/pendientes-nombre/${id}`, { method: 'DELETE' });
      onRefresh?.();
    } catch (error) {
      console.error('Error ignorando pendiente:', error);
    }
    setLoading(false);
  };

  const startEditing = (p) => {
    setEditingId(p.id);
    setNombreLimpio(p.sugerencias?.[0] || '');
  };

  return (
    <div className="space-y-6">
      {/* Pendientes */}
      {filteredPendientes.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-[var(--warn)]" />
            <h3 className="font-semibold text-[var(--label)]">
              Nombres pendientes de resolver ({filteredPendientes.length})
            </h3>
          </div>

          <div className="space-y-3">
            {filteredPendientes.map((p, idx) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-[var(--fill2)] opacity-0 animate-fade-in-up"
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'forwards' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-[var(--label)]">{p.referencia_original}</p>
                    {p.sugerencias?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.sugerencias.map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => { setEditingId(p.id); setNombreLimpio(sug); }}
                            className="text-xs px-2 py-0.5 rounded-full bg-[var(--r2)]/20
                                       text-[var(--r2)] hover:bg-[var(--r2)]/30 transition-all"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {editingId !== p.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(p)}
                        className="p-2 rounded-lg bg-emerald-500/20 text-[var(--ok)] hover:bg-emerald-500/30 transition-all"
                        title="Resolver"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleIgnorar(p.id)}
                        disabled={loading}
                        className="p-2 rounded-lg bg-red-500/20 text-[var(--danger)] hover:bg-red-500/30 transition-all
                                   disabled:opacity-50"
                        title="Ignorar"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Input para editar */}
                {editingId === p.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={nombreLimpio}
                      onChange={(e) => setNombreLimpio(e.target.value)}
                      placeholder="Nombre limpio..."
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--fill2)] border border-[var(--sep)]
                                 text-[var(--label)] text-sm focus:outline-none focus:border-[var(--r2)]"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleResolver(p.id)}
                    />
                    <button
                      onClick={() => handleResolver(p.id)}
                      disabled={loading || !nombreLimpio.trim()}
                      className="px-4 py-2 rounded-lg bg-[var(--inv)] text-[var(--inv-text)] font-medium
                                 hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setNombreLimpio(''); }}
                      className="px-3 py-2 rounded-lg bg-[var(--fill2)] text-[var(--label2)]
                                 hover:bg-opacity-80 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Reglas */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-[var(--label)] mb-4">
          Reglas de limpieza ({filteredReglas.length})
          {reglasUnicas.length < reglas.length && (
            <span className="text-xs text-[var(--label2)] ml-2">
              ({reglas.length - reglasUnicas.length} duplicadas eliminadas)
            </span>
          )}
        </h3>

        <div className="space-y-3">
          {filteredReglas.map((regla, idx) => (
            <div
              key={regla.id || idx}
              className="flex items-center justify-between p-4 rounded-xl bg-[var(--fill2)]
                         opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'forwards' }}
            >
              <div className="flex items-center gap-4">
                <Tag className="w-4 h-4 text-[var(--r2)]" />
                <div>
                  <code className="text-sm text-[var(--label2)]">{regla.patron}</code>
                  <p className="font-medium text-[var(--label)]">→ {regla.nombre_limpio}</p>
                </div>
              </div>
              <span className="text-sm text-[var(--label2)]">
                {regla.veces_usado || 0} usos
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Importar View
const BANCOS_COMUNES = ['Santander', 'Galicia', 'BBVA', 'Macro', 'Nación', 'Provincia', 'HSBC', 'ICBC', 'Patagonia', 'Supervielle', 'Credicoop', 'Ciudad', 'Brubank', 'Naranja X', 'American Express'];

// Texto de una línea para un grupo importado: "Santander Visa #3327 · #1510 — 25 consumos · ✓ total del banco"
const describirGrupo = (g, alias) => {
  const a = g.bloques.map(b => alias[b.ult4]).find(Boolean) || {};
  const n = g.bloques.reduce((s, b) => s + b.consumos.filter(c => !c.es_pago).length, 0);
  const ok = g.bloques.every(b => b.validado);
  return `${a.banco || '(banco sin indicar)'} ${a.red || g.bloques[0].red} ${g.bloques.map(b => `#${b.ult4}`).join(' · ')} — ${n} consumos${ok ? ' · ✓ coincide con el total del banco' : ''}`;
};

/**
 * Bandeja única de importación: resúmenes (PDF / capturas → backend) y
 * últimos consumos (Excel / CSV → se leen en el navegador). Reconoce cuál es
 * cuál por el tipo de archivo y, dentro de los Excel, por su formato.
 */
const ImportarView = ({ onSuccess, preguntasFijos = [], onResponderPregunta }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [results, setResults] = useState([]);
  const [mapeoManual, setMapeoManual] = useState(null); // formato nuevo sin IA disponible

  // ---------- Resúmenes (PDF / imagen) ----------
  const subirResumenes = async (files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('pdfs', file));
    try {
      const response = await fetch(`${API_BASE}/resumenes/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      const resultados = data.data?.resultados || data.resultados || [];
      for (const resultado of resultados) {
        resultado.tipo = 'resumen';
        if (resultado.exito && resultado.datos) {
          const { resumen, movimientos, tarjeta } = resultado.datos;
          let banco = resumen?.banco;
          let tipo = resumen?.tipo;
          if (tarjeta) {
            if (!banco || banco === 'Desconocido') {
              const n = tarjeta.toUpperCase();
              if (n.includes('GALICIA')) banco = 'Galicia';
              else if (n.includes('MACRO')) banco = 'Macro';
              else if (n.includes('SANTANDER')) banco = 'Santander';
              else if (n.includes('BBVA')) banco = 'BBVA';
              else if (n.includes('HSBC')) banco = 'HSBC';
            }
            if (!tipo) {
              const n = tarjeta.toUpperCase();
              if (n.includes('AMEX') || n.includes('AMERICAN EXPRESS')) tipo = 'AMEX';
              else if (n.includes('MASTERCARD')) tipo = 'MASTERCARD';
              else tipo = 'VISA';
            }
            storage.saveTarjeta({ nombre: tarjeta, banco: banco || 'Desconocido', tipo });
          }
          if (resumen) {
            const resumenId = `${tarjeta}-${resumen.anio}-${resumen.mes}`;
            storage.saveResumen({
              id: resumenId,
              tarjeta,
              mes: resumen.mes,
              anio: resumen.anio,
              fecha_cierre: resumen.fecha_cierre,
              fecha_vencimiento: resumen.fecha_vencimiento,
              total_a_pagar_pesos: resumen.total_a_pagar_pesos || 0,
              total_a_pagar_dolares: resumen.total_a_pagar_dolares || 0,
              total_consumos_pesos: resumen.total_consumos_pesos || 0,
              total_consumos_dolares: resumen.total_consumos_dolares || 0,
              impuestos: resumen.impuestos || {},
              cantidad_movimientos: movimientos?.length || 0,
              fecha_importacion: new Date().toISOString()
            });
            if (movimientos && movimientos.length > 0) {
              storage.saveMovimientos(resumenId, movimientos, tarjeta);
            }
            // Si había Últimos consumos de este ciclo, el resumen los reemplaza en el dashboard.
            const conciliados = conciliarResumen({ banco, tipo, fecha_cierre: resumen.fecha_cierre }, movimientos || []);
            if (conciliados.length) resultado.detalle = 'Reemplaza los Últimos consumos de este ciclo en el dashboard';
          }
        }
      }
      return resultados;
    } catch (error) {
      console.error('Upload error:', error);
      return [{ archivo: files.map(f => f.name).join(', '), tipo: 'resumen', exito: false, error: error.message }];
    }
  };

  // ---------- Últimos consumos (Excel / CSV) ----------
  const procesarHojas = async (hojas, nombre, { permitirIA = true } = {}) => {
    let res = parseUltimosConsumos(hojas, { plantillas: getPlantillas() });

    if (res.requiereMapeo && permitirIA) {
      const prep = res.requiereMapeo;
      try {
        const r = await fetch(`${API_BASE}/consumos/mapear-columnas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encabezados: prep.headers, filas_muestra: prep.filas_muestra, texto_cabecera: prep.texto_cabecera })
        });
        const data = await r.json();
        const m = data?.data;
        if (r.ok && m?.mapeo && (m.confianza ?? 0) >= 0.7) {
          guardarPlantilla({ firma: prep.firma, mapeo: m.mapeo, banco: m.banco_detectado || '', red: m.red_detectada || '', origen: 'ia' });
          res = parseUltimosConsumos(hojas, { plantillas: getPlantillas() });
        }
      } catch (e) {
        console.warn('[Importar] Mapeo con IA no disponible:', e.message);
      }
    }
    if (res.requiereMapeo) {
      setMapeoManual({ nombre, hojas, prep: res.requiereMapeo });
      return { archivo: nombre, tipo: 'consumos', exito: false, error: 'Formato nuevo: indicá qué columna es cada dato.' };
    }
    if (!res.bloques.length) {
      return { archivo: nombre, tipo: 'consumos', exito: false, error: res.warnings[0] || 'No se reconocieron consumos.' };
    }

    // Se importa SIEMPRE al instante. Si el archivo no dice el banco (Santander,
    // Galicia y Amex exportan igual) la Card del dashboard lo pide una sola vez.
    const grupos = agruparBloques(res.bloques);
    const alias = getAlias();
    const archivo = { id: `${nombre}|${Date.now()}`, nombre };
    const asignaciones = Object.fromEntries(grupos.map((g, i) => [i, { banco: aliasConocido(g, alias) ? undefined : (res.banco_sugerido || '') }]));
    importarGrupos({ grupos, asignaciones, archivo });
    const aliasNuevo = getAlias();
    const faltaBanco = grupos.some(g => g.bloques.some(b => !aliasNuevo[b.ult4]?.banco));
    return {
      archivo: nombre, tipo: 'consumos', exito: true, pendiente: faltaBanco,
      detalle: grupos.map(g => describirGrupo(g, aliasNuevo)).join('\n') + (faltaBanco ? '\nFalta el banco: indicalo en su Card del Dashboard.' : ''),
      warnings: res.warnings
    };
  };

  const confirmarMapeoManual = async (map) => {
    const { nombre, hojas, prep } = mapeoManual;
    guardarPlantilla({
      firma: prep.firma, origen: 'manual',
      mapeo: { fecha: map.fecha, descripcion: map.descripcion, monto_ars: map.monto, monto_usd: map.montoDolares || null, cuotas: map.cuotas || null }
    });
    setMapeoManual(null);
    const r = await procesarHojas(hojas, nombre, { permitirIA: false });
    setResults(prev => [...prev.filter(x => x.archivo !== nombre), r]);
    onSuccess?.();
  };

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    setResults([]);
    const planillas = files.filter(f => EXTENSIONES_CONSUMOS.test(f.name));
    const resumenesArch = files.filter(f => !EXTENSIONES_CONSUMOS.test(f.name));
    const out = [];
    if (resumenesArch.length) out.push(...await subirResumenes(resumenesArch));
    for (const f of planillas) {
      try {
        out.push(await procesarHojas(await leerHojas(await f.arrayBuffer()), f.name));
      } catch (err) {
        out.push({ archivo: f.name, tipo: 'consumos', exito: false, error: `No se pudo leer el archivo: ${err.message}` });
      }
    }
    setResults(out);
    onSuccess?.();
    setUploading(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={`glass-card p-12 text-center border-2 border-dashed transition-all cursor-pointer
                    ${dragOver ? 'border-[var(--r2)] bg-[var(--r2)]/10' : 'border-[var(--sep)]'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,.xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
        />
        {uploading ? (
          <div className="animate-pulse">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-[var(--r2)]" />
            <p className="text-lg font-medium text-[var(--label)]">Procesando...</p>
          </div>
        ) : (
          <>
            <Upload className="w-16 h-16 mx-auto mb-4 text-[var(--r2)] opacity-70" />
            <p className="text-lg font-medium text-[var(--label)] mb-2">
              Arrastrá resúmenes o últimos consumos
            </p>
            <p className="text-sm text-[var(--label2)]">
              Resúmenes: PDF o capturas · Últimos consumos: Excel (.xlsx, .xls) o CSV
            </p>
            <p className="text-xs text-[var(--label2)] mt-1">La app reconoce cuál es cuál. Podés subir varios juntos.</p>
          </>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6 space-y-3">
          {results.map((r, idx) => (
            <div
              key={idx}
              className={`glass-card p-4 flex items-start gap-3 opacity-0 animate-fade-in-up
                         ${!r.exito ? 'border-l-4 border-l-red-500' : r.pendiente ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-emerald-500'}`}
              style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'forwards' }}
            >
              {!r.exito ? <XCircle className="w-5 h-5 text-[var(--danger)] mt-0.5" />
                : r.pendiente ? <AlertCircle className="w-5 h-5 text-[var(--warn)] mt-0.5" />
                : <CheckCircle className="w-5 h-5 text-[var(--ok)] mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--label)] truncate">{r.archivo}</p>
                <p className="text-[10px] uppercase tracking-widest text-[var(--label2)] mt-0.5">
                  {r.tipo === 'consumos' ? 'Últimos consumos' : 'Resumen'}
                </p>
                {r.error && <p className="text-sm text-[var(--danger)]">{r.error}</p>}
                {r.movimientos && (
                  <p className="text-sm text-[var(--label2)]">{r.movimientos} movimientos importados</p>
                )}
                {r.detalle && <p className="text-sm text-[var(--label2)] whitespace-pre-line">{r.detalle}</p>}
                {r.warnings?.map((w, i) => <p key={i} className="text-xs text-[var(--warn)] mt-1">{w}</p>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {mapeoManual && (
        <CSVColumnMapper
          headers={mapeoManual.prep.headers}
          preview={mapeoManual.prep.filas_muestra}
          onConfirm={confirmarMapeoManual}
          onCancel={() => setMapeoManual(null)}
        />
      )}

      {/* Después de importar: preguntas sobre gastos fijos que faltan en el resumen nuevo */}
      {results.some(r => r.exito && r.tipo === 'resumen') && preguntasFijos.length > 0 && (
        <div className="mt-6">
          <PreguntasFijosCard preguntas={preguntasFijos} onResponder={onResponderPregunta} />
        </div>
      )}
    </div>
  );
};

// ==================== Últimos Consumos (pre-resumen) ====================

// Modal de mapeo manual de columnas (fallback si el formato no se reconoce)
const CSVColumnMapper = ({ headers, preview, onConfirm, onCancel }) => {
  const [map, setMap] = useState({ fecha: '', descripcion: '', monto: '', montoDolares: '', cuotas: '' });
  const campos = [
    { key: 'fecha', label: 'Fecha', req: true },
    { key: 'descripcion', label: 'Descripción', req: true },
    { key: 'monto', label: 'Monto en pesos', req: true },
    { key: 'montoDolares', label: 'Monto en dólares', req: false },
    { key: 'cuotas', label: 'Cuotas', req: false },
  ];
  const valido = map.fecha && map.descripcion && map.monto;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="glass-card p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-[var(--label)] mb-1">Mapear columnas</h3>
        <p className="text-sm text-[var(--label2)] mb-4">
          No reconocimos el formato. Indicá qué columna es cada campo.
        </p>
        <div className="space-y-3">
          {campos.map(({ key, label, req }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="w-40 text-sm text-[var(--label2)]">
                {label}{req && <span className="text-[var(--danger)]"> *</span>}
              </label>
              <select
                value={map[key]}
                onChange={(e) => setMap({ ...map, [key]: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--fill2)] border border-[var(--sep)] text-[var(--label)] text-sm"
              >
                <option value="">— Ninguna —</option>
                {headers.map((h, i) => (
                  <option key={i} value={String(i)}>{h || `Columna ${i + 1}`}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-[var(--fill2)] text-[var(--label2)] text-sm">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(map)}
            disabled={!valido}
            className="px-4 py-2 rounded-lg bg-[var(--inv)] text-[var(--inv-text)] font-medium text-sm disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

// ConsumosLiveView → views/ConsumosLiveView.jsx (fase 6).

export default App;
// Build 1769553006
