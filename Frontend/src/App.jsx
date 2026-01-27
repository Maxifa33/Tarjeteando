import React, { useState, useEffect, useCallback } from 'react';
import storage from './services/storage';
import {
  LayoutDashboard, Receipt, CreditCard, Tag, Upload,
  TrendingUp, TrendingDown, Calendar, AlertCircle, ChevronRight,
  Sun, Moon, Bell, Settings, Search, Menu, X, DollarSign,
  PieChart, BarChart3, Wallet, ArrowUpRight, ArrowDownRight,
  FileText, Clock, CheckCircle, XCircle, Sparkles, Trophy, Filter,
  RefreshCcw, Trash2, Download, Edit3, Plus
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = `${API_URL}/api/v1`;

// Componente de Onboarding para nuevos usuarios
const OnboardingWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: "Bienvenido a Tarjeteando",
      description: "Tu asistente inteligente para gestionar los resumenes de tus tarjetas de credito. Vamos a configurar todo en 3 simples pasos.",
      icon: Wallet,
      content: (
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] flex items-center justify-center shadow-2xl">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Bienvenido a Tarjeteando</h2>
          <p className="text-[var(--text-muted)] max-w-md mx-auto">
            Tu asistente inteligente para gestionar los resumenes de tus tarjetas de credito.
            Te ayudamos a entender tus gastos, trackear cuotas y proyectar pagos futuros.
          </p>
        </div>
      )
    },
    {
      title: "Subi tu primer resumen",
      description: "Simplemente arrastra o selecciona el PDF de tu resumen de tarjeta.",
      icon: Upload,
      content: (
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl">
            <Upload className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Subi tu primer resumen</h2>
          <p className="text-[var(--text-muted)] max-w-md mx-auto mb-4">
            Arrastra el PDF de tu resumen de tarjeta o hace click para seleccionarlo.
            Soportamos VISA, Mastercard y American Express de los principales bancos argentinos.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            {['Galicia', 'Macro', 'Santander', 'BBVA', 'HSBC', 'ICBC'].map(banco => (
              <span key={banco} className="px-3 py-1.5 rounded-full bg-[var(--glass-bg)] text-sm text-[var(--text-muted)] border border-[var(--glass-border)]">
                {banco}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 text-amber-500 bg-amber-500/10 rounded-lg px-4 py-2 max-w-md mx-auto">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">La primera carga puede tardar unos segundos mientras procesamos el PDF</p>
          </div>
        </div>
      )
    },
    {
      title: "Tips y funcionalidades",
      description: "Aprovecha al maximo Tarjeteando.",
      icon: Sparkles,
      content: (
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Tips y funcionalidades</h2>
          <div className="space-y-3 max-w-md mx-auto text-left">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
              <FileText className="w-5 h-5 text-[var(--accent-1)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Subi todos tus resumenes</p>
                <p className="text-xs text-[var(--text-muted)]">Carga varios meses para ver el historial completo y mejores proyecciones</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
              <Edit3 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Renombra comercios</p>
                <p className="text-xs text-[var(--text-muted)]">Podes asignar nombres claros a comercios con nombres confusos desde Configuracion</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
              <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Tus datos son privados</p>
                <p className="text-xs text-[var(--text-muted)]">Todo se guarda en tu navegador. No almacenamos tus resumenes en ningun servidor</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentStep = steps[step - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Animated Background */}
      <div className="animated-bg" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl glass-card p-8 animate-fade-in-up">
        {/* Progress Bar */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx + 1 === step
                  ? 'w-8 bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)]'
                  : idx + 1 < step
                    ? 'w-8 bg-emerald-500'
                    : 'w-2 bg-[var(--glass-border)]'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px] flex items-center justify-center">
          {currentStep.content}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--glass-border)]">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
              step === 1
                ? 'opacity-0 pointer-events-none'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]'
            }`}
          >
            Anterior
          </button>

          <span className="text-sm text-[var(--text-muted)]">
            Paso {step} de {steps.length}
          </span>

          {step < steps.length ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-6 py-2.5 rounded-xl font-medium bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] text-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-6 py-2.5 rounded-xl font-medium bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              Comenzar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Colores consistentes por tarjeta para todos los gráficos
const TARJETA_COLORS = {
  'VISA Santander': '#DC2626',       // Rojo
  'Mastercard Santander': '#EF4444', // Rojo claro
  'VISA Galicia': '#F97316',         // Naranja
  'Mastercard Galicia': '#FBBF24',   // Amarillo
  'VISA Macro': '#06B6D4',           // Celeste
  'Mastercard Macro': '#22D3EE',     // Celeste claro
  'VISA BBVA': '#2563EB',            // Azul
  'Mastercard BBVA': '#6366F1',      // Indigo
};

// Función para obtener color de tarjeta (con fallback)
const getTarjetaColor = (nombre) => {
  // Buscar coincidencia exacta
  if (TARJETA_COLORS[nombre]) return TARJETA_COLORS[nombre];

  // Buscar coincidencia parcial
  const nombreLower = nombre.toLowerCase();
  if (nombreLower.includes('santander')) return '#DC2626';
  if (nombreLower.includes('galicia') && nombreLower.includes('master')) return '#FBBF24';
  if (nombreLower.includes('galicia')) return '#F97316';
  if (nombreLower.includes('macro')) return '#06B6D4';
  if (nombreLower.includes('bbva')) return '#2563EB';

  // Fallback con colores por índice
  const fallbackColors = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];
  const hash = nombre.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackColors[hash % fallbackColors.length];
};

// Theme colors por banco
const BANK_THEMES = {
  'VISA Galicia': { gradient: 'from-orange-500 via-orange-600 to-orange-700', color: '#F97316', icon: '🍊' },
  'Mastercard Galicia': { gradient: 'from-orange-400 via-red-500 to-pink-600', color: '#EC4899', icon: '💳' },
  'VISA BBVA': { gradient: 'from-blue-500 via-blue-600 to-blue-800', color: '#2563EB', icon: '🔵' },
  'Mastercard BBVA': { gradient: 'from-blue-400 via-indigo-500 to-purple-600', color: '#6366F1', icon: '💠' },
  'VISA Santander': { gradient: 'from-red-500 via-red-600 to-red-800', color: '#DC2626', icon: '🔴' },
  'VISA Macro': { gradient: 'from-slate-100 via-sky-200 to-blue-400', color: '#1e3a5f', icon: '🏦', textDark: true, textColor: 'text-blue-900' },
  'Mastercard Macro': { gradient: 'from-slate-100 via-sky-200 to-blue-400', color: '#1e3a5f', icon: '🏦', textDark: true, textColor: 'text-blue-900' },
};

// Obtener tema por banco (match flexible para nombres personalizados)
const getCardTheme = (nombre) => {
  if (BANK_THEMES[nombre]) return BANK_THEMES[nombre];
  const n = nombre.toUpperCase();
  if (n.includes('MACRO')) return n.includes('MASTER') ? BANK_THEMES['Mastercard Macro'] : BANK_THEMES['VISA Macro'];
  if (n.includes('GALICIA')) return n.includes('MASTER') ? BANK_THEMES['Mastercard Galicia'] : BANK_THEMES['VISA Galicia'];
  if (n.includes('BBVA')) return n.includes('MASTER') ? BANK_THEMES['Mastercard BBVA'] : BANK_THEMES['VISA BBVA'];
  if (n.includes('SANTANDER')) return BANK_THEMES['VISA Santander'];
  return BANK_THEMES['VISA Galicia'];
};

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

// Animated Number Component
const AnimatedNumber = ({ value, prefix = '', suffix = '', decimals = 2 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const stepValue = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return (
    <span className="number-animate">
      {prefix}{displayValue.toLocaleString('es-AR', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      })}{suffix}
    </span>
  );
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, trend, trendValue, delay = 0, onClick }) => {
  const isPositive = trend === 'up';

  return (
    <div
      onClick={onClick}
      className={`stat-card opacity-0 animate-fade-in-up ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] bg-opacity-20">
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
};

// Credit Card Component
const CreditCardVisual = ({ tarjeta, stats, onClick, nombrePersonalizado, onEditarNombre }) => {
  const theme = getCardTheme(tarjeta.nombre);
  const ultimoResumen = stats?.ultimo_resumen;
  const [editando, setEditando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');

  // Detectar banco desde nombre si es Desconocido
  const getBanco = () => {
    if (tarjeta.banco && tarjeta.banco !== 'Desconocido') return tarjeta.banco;
    const n = (tarjeta.nombre || '').toUpperCase();
    if (n.includes('GALICIA')) return 'Galicia';
    if (n.includes('MACRO')) return 'Macro';
    if (n.includes('SANTANDER')) return 'Santander';
    if (n.includes('BBVA')) return 'BBVA';
    if (n.includes('HSBC')) return 'HSBC';
    return tarjeta.banco || '';
  };

  // Nombre por defecto: TIPO Banco (ej: VISA Galicia)
  const banco = getBanco();
  const nombreDefault = banco ? `${tarjeta.tipo || 'VISA'} ${banco}` : tarjeta.nombre;
  const nombreMostrar = nombrePersonalizado || nombreDefault;

  // Colores de texto según si la tarjeta es clara u oscura
  const textPrimary = theme.textColor || (theme.textDark ? 'text-slate-800' : 'text-white');
  const textSecondary = theme.textColor ? 'text-blue-800' : (theme.textDark ? 'text-slate-600' : 'text-white/70');
  const textMuted = theme.textColor ? 'text-blue-700' : (theme.textDark ? 'text-slate-500' : 'text-white/60');

  const handleGuardar = () => {
    if (nuevoNombre.trim()) {
      onEditarNombre?.(tarjeta.id, nuevoNombre.trim());
    }
    setEditando(false);
  };

  return (
    <div
      className={`credit-card bg-gradient-to-br ${theme.gradient} cursor-pointer group`}
    >
      {/* Card shine effect */}
      <div className={`absolute inset-0 bg-gradient-to-tr ${theme.textDark ? 'from-blue-500/0 via-blue-500/10 to-blue-500/0' : 'from-white/0 via-white/20 to-white/0'}
                      opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

      {/* Card content */}
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1">
            {editando ? (
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onBlur={handleGuardar}
                onKeyDown={(e) => e.key === 'Enter' && handleGuardar()}
                autoFocus
                placeholder={nombreDefault}
                className={`${theme.textDark ? 'bg-slate-800/20 text-slate-800 placeholder:text-slate-500' : 'bg-white/20 text-white placeholder:text-white/50'} px-2 py-1 rounded text-sm w-full outline-none`}
              />
            ) : (
              <div className="flex items-center gap-2">
                <p className={`${textPrimary} font-semibold text-lg`}>{nombreMostrar}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNuevoNombre(nombreMostrar);
                    setEditando(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/20"
                  title="Editar nombre"
                >
                  <Edit3 className={`w-4 h-4 ${textSecondary}`} />
                </button>
              </div>
            )}
            <p className={`${textSecondary} text-xs uppercase tracking-wider`}>{tarjeta.banco}</p>
          </div>
          <div className="text-right space-y-1">
            <div>
              <p className={`${textMuted} text-[10px] uppercase tracking-wider`}>Cierre</p>
              <p className={`${textPrimary} font-medium text-sm`}>
                {ultimoResumen?.fecha_cierre
                  ? new Date(ultimoResumen.fecha_cierre + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '')
                  : '-'}
              </p>
            </div>
            <div>
              <p className={`${textMuted} text-[10px] uppercase tracking-wider`}>Vto.</p>
              <p className={`${textPrimary} font-medium text-sm`}>
                {ultimoResumen?.fecha_vencimiento
                  ? new Date(ultimoResumen.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '')
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className={`${textMuted} text-xs mb-1`}>Último resumen</p>
          {ultimoResumen ? (
            <>
              <p className={`${textPrimary} text-2xl font-bold`}>
                {formatMonto(ultimoResumen.total_a_pagar || 0)}
              </p>
              {ultimoResumen.total_a_pagar_dolares > 0 && (
                <p className="text-emerald-500 text-sm font-medium">
                  {formatMontoDolares(ultimoResumen.total_a_pagar_dolares)}
                </p>
              )}
            </>
          ) : (
            <p className={`${textMuted} text-lg`}>Sin datos</p>
          )}
        </div>
        
        <div className="flex justify-between items-end">
          <div className="flex gap-4">
            <div>
              <p className={`${textMuted} text-xs`}>Movimientos</p>
              <p className={`${textPrimary} font-semibold`}>{stats?.estadisticas?.total_movimientos || 0}</p>
            </div>
            <div>
              <p className={`${textMuted} text-xs`}>En cuotas</p>
              <p className={`${textPrimary} font-semibold`}>{stats?.estadisticas?.compras_en_cuotas || 0}</p>
            </div>
          </div>
          <div className="text-3xl opacity-80">{theme.icon}</div>
        </div>
      </div>
    </div>
  );
};

// Settings Modal Component - Fondo sólido y cierre al clickear fuera
const SettingsModal = ({ isOpen, onClose, tarjetas, reglas, movimientos, resumenes, cuotasActivas, onRefreshData, theme, setTheme, initialTab = 'tarjetas', pendientes = [], onResolvePendiente }) => {
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
  const [newRegla, setNewRegla] = useState({ patron: '', nombre_limpio: '' });
  const [editingPendiente, setEditingPendiente] = useState(null);
  const [pendienteNombreLimpio, setPendienteNombreLimpio] = useState('');
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
    { id: 'reglas', label: 'Reglas', icon: Tag, badge: pendientes.length },
    { id: 'alertas', label: 'Alertas', icon: Bell },
    { id: 'datos', label: 'Datos', icon: Download },
    { id: 'temas', label: 'Temas', icon: Sun },
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
      storage.saveRegla(newRegla);
      setNewRegla({ patron: '', nombre_limpio: '' });
      onRefreshData?.();
    } catch (e) { console.error('Error agregando regla:', e); }
  };

  const handleDeleteRegla = async (id) => {
    try {
      storage.deleteRegla(id);
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

  const themeOptions = [
    { id: 'light', label: 'Claro', icon: Sun, colors: ['#f8fafc', '#e2e8f0'] },
    { id: 'dark', label: 'Oscuro', icon: Moon, colors: ['#1e293b', '#0f172a'] },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden mx-4"
        style={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
          <h2 className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Configuración</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ backgroundColor: 'transparent' }}
          >
            <X className="w-5 h-5" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto" style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                         ${activeTab === tab.id
                           ? 'border-b-2 border-violet-500 text-violet-600'
                           : 'hover:bg-gray-50'}`}
              style={activeTab !== tab.id ? { color: theme === 'dark' ? '#9ca3af' : '#6b7280' } : {}}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-amber-500 text-white">
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
                <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Gestión de Tarjetas</h3>

                {/* Nueva tarjeta */}
                <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                  <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#d1d5db' : '#374151' }}>Agregar nueva tarjeta</p>
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={newTarjeta.nombre}
                      onChange={(e) => setNewTarjeta({...newTarjeta, nombre: e.target.value})}
                      className="px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                        color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
                      }}
                    />
                    <select
                      value={newTarjeta.tipo}
                      onChange={(e) => setNewTarjeta({...newTarjeta, tipo: e.target.value})}
                      className="px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                        color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
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
                        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                        color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleAddTarjeta}
                    disabled={!newTarjeta.nombre || !newTarjeta.banco}
                    className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium
                               hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Agregar Tarjeta
                  </button>
                </div>

                {/* Lista de tarjetas */}
                <div className="space-y-3">
                  {tarjetas.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                      {editingTarjeta === t.id ? (
                        <div className="flex-1 flex items-center gap-3">
                          <input
                            type="text"
                            defaultValue={t.nombre}
                            id={`edit-nombre-${t.id}`}
                            className="px-3 py-1.5 rounded-lg border text-sm flex-1"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                              borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                              color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
                            }}
                          />
                          <button
                            onClick={() => handleUpdateTarjeta(t.id, {
                              nombre: document.getElementById(`edit-nombre-${t.id}`).value
                            })}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingTarjeta(null)}
                            className="px-3 py-1.5 rounded-lg text-sm"
                            style={{ backgroundColor: theme === 'dark' ? '#4b5563' : '#d1d5db', color: theme === 'dark' ? '#f5f5f5' : '#374151' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="font-medium" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>{t.nombre}</p>
                            <p className="text-sm" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>{t.tipo} - {t.banco}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingTarjeta(t.id)}
                              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                            </button>
                            <button
                              onClick={() => handleDeleteTarjeta(t.nombre)}
                              className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              <XCircle className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {tarjetas.length === 0 && (
                    <p className="text-center py-8" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>No hay tarjetas registradas</p>
                  )}
                </div>
              </div>
            )}

            {/* Preferencias */}
            {activeTab === 'preferencias' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Preferencias de Usuario</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: theme === 'dark' ? '#d1d5db' : '#374151' }}>
                      Moneda por defecto
                    </label>
                    <select
                      value={preferencias.monedaDefault || 'ARS'}
                      onChange={(e) => setPreferencias({...preferencias, monedaDefault: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                        color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
                      }}
                    >
                      <option value="ARS">Pesos Argentinos (ARS)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: theme === 'dark' ? '#d1d5db' : '#374151' }}>
                      Formato de fechas
                    </label>
                    <select
                      value={preferencias.formatoFecha || 'dd/mm/yyyy'}
                      onChange={(e) => setPreferencias({...preferencias, formatoFecha: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                        color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
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

            {/* Reglas de limpieza */}
            {activeTab === 'reglas' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Reglas de Limpieza</h3>

                {/* Pendientes por resolver */}
                {pendientes.length > 0 && (
                  <div className="p-4 rounded-xl border-2 border-amber-500/30" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#fef3c7' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <p className="font-medium" style={{ color: theme === 'dark' ? '#fbbf24' : '#92400e' }}>
                        Nombres pendientes de resolver ({pendientes.length})
                      </p>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {pendientes.map(p => (
                        <div key={p.id} className="p-3 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff' }}>
                          {editingPendiente === p.id ? (
                            <div className="space-y-2">
                              <p className="text-xs" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                                Original: {p.referencia_original}
                              </p>
                              <input
                                type="text"
                                value={pendienteNombreLimpio}
                                onChange={(e) => setPendienteNombreLimpio(e.target.value)}
                                placeholder="Nombre limpio..."
                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                style={{
                                  backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6',
                                  borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                                  color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
                                }}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (pendienteNombreLimpio.trim()) {
                                      // Crear regla con el patrón y nombre limpio
                                      const patron = p.referencia_original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').substring(0, 30);
                                      storage.saveRegla({ patron, nombre_limpio: pendienteNombreLimpio.trim() });
                                      // Marcar pendiente como resuelto
                                      onResolvePendiente?.(p.id, p.refNorm);
                                      setEditingPendiente(null);
                                      setPendienteNombreLimpio('');
                                    }
                                  }}
                                  disabled={!pendienteNombreLimpio.trim()}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium
                                             hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPendiente(null);
                                    setPendienteNombreLimpio('');
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-sm"
                                  style={{ backgroundColor: theme === 'dark' ? '#4b5563' : '#d1d5db', color: theme === 'dark' ? '#f5f5f5' : '#374151' }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>
                                  {p.referencia_original}
                                </p>
                                {p.sugerencias && p.sugerencias.length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {p.sugerencias.slice(0, 3).map((s, i) => (
                                      <button
                                        key={i}
                                        onClick={() => {
                                          setEditingPendiente(p.id);
                                          setPendienteNombreLimpio(s);
                                        }}
                                        className="text-xs px-2 py-0.5 rounded bg-violet-500/20 text-violet-500 hover:bg-violet-500/30 transition-colors"
                                      >
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setEditingPendiente(p.id);
                                  setPendienteNombreLimpio(p.sugerencias?.[0] || '');
                                }}
                                className="ml-2 p-2 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 transition-colors"
                                title="Resolver"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nueva regla */}
                <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                  <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#d1d5db' : '#374151' }}>Agregar nueva regla</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Patrón (ej: MERPAGO*)"
                      value={newRegla.patron}
                      onChange={(e) => setNewRegla({...newRegla, patron: e.target.value})}
                      className="px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                        color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Nombre limpio (ej: Mercado Pago)"
                      value={newRegla.nombre_limpio}
                      onChange={(e) => setNewRegla({...newRegla, nombre_limpio: e.target.value})}
                      className="px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                        color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleAddRegla}
                    disabled={!newRegla.patron || !newRegla.nombre_limpio}
                    className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium
                               hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Agregar Regla
                  </button>
                </div>

                {/* Lista de reglas */}
                <div className="space-y-3">
                  {reglas.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                      <div>
                        <code className="text-sm text-violet-500">{r.patron}</code>
                        <p style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>→ {r.nombre_limpio}</p>
                        <p className="text-xs" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>{r.veces_usado || 0} usos</p>
                      </div>
                      <button
                        onClick={() => handleDeleteRegla(r.id)}
                        className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <XCircle className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                  {reglas.length === 0 && (
                    <p className="text-center py-8" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>No hay reglas personalizadas</p>
                  )}
                </div>
              </div>
            )}

            {/* Alertas */}
            {activeTab === 'alertas' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Configuración de Alertas</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                    <div>
                      <p className="font-medium" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Alerta de vencimiento</p>
                      <p className="text-sm" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>Notificar antes del vencimiento de pago</p>
                    </div>
                    <button
                      onClick={() => setAlertas({...alertas, vencimiento: !alertas.vencimiento})}
                      className={`w-12 h-6 rounded-full transition-colors relative
                                 ${alertas.vencimiento ? 'bg-violet-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                                      ${alertas.vencimiento ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                    <div>
                      <p className="font-medium" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Alerta de última cuota</p>
                      <p className="text-sm" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>Notificar cuando una compra llega a su última cuota</p>
                    </div>
                    <button
                      onClick={() => setAlertas({...alertas, cuotaFinal: !alertas.cuotaFinal})}
                      className={`w-12 h-6 rounded-full transition-colors relative
                                 ${alertas.cuotaFinal ? 'bg-violet-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                                      ${alertas.cuotaFinal ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="p-4 rounded-xl" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                    <label className="block font-medium mb-2" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>
                      Días de anticipación
                    </label>
                    <select
                      value={alertas.diasAntes || 3}
                      onChange={(e) => setAlertas({...alertas, diasAntes: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 rounded-xl border"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db',
                        color: theme === 'dark' ? '#f5f5f5' : '#1f2937'
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
                <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Importar / Exportar Datos</h3>

                {/* Exportar CSV */}
                <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                  <p className="font-medium" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Exportar a CSV</p>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => exportarCSV('movimientos')}
                      className="px-4 py-3 rounded-xl border text-center transition-colors hover:bg-gray-100"
                      style={{ borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db', color: theme === 'dark' ? '#d1d5db' : '#374151' }}
                    >
                      <FileText className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Movimientos</span>
                    </button>
                    <button
                      onClick={() => exportarCSV('cuotas')}
                      className="px-4 py-3 rounded-xl border text-center transition-colors hover:bg-gray-100"
                      style={{ borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db', color: theme === 'dark' ? '#d1d5db' : '#374151' }}
                    >
                      <Calendar className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Cuotas</span>
                    </button>
                    <button
                      onClick={() => exportarCSV('resumenes')}
                      className="px-4 py-3 rounded-xl border text-center transition-colors hover:bg-gray-100"
                      style={{ borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db', color: theme === 'dark' ? '#d1d5db' : '#374151' }}
                    >
                      <Receipt className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Resúmenes</span>
                    </button>
                  </div>
                </div>

                {/* Backup completo */}
                <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                  <p className="font-medium" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Backup de Configuración</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleExportAll}
                      className="flex-1 px-4 py-3 rounded-xl bg-violet-500 text-white hover:bg-violet-600 transition-colors text-center"
                    >
                      <Download className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Exportar Todo</span>
                    </button>
                    <label className="flex-1 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center hover:border-violet-500"
                           style={{ borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db', color: theme === 'dark' ? '#d1d5db' : '#374151' }}>
                      <Upload className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-sm">Importar</span>
                      <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Refrescar datos */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Refrescar datos</p>
                      <p className="text-sm" style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>Recargar todos los datos desde el servidor</p>
                    </div>
                    <button
                      onClick={() => { onRefreshData(); onClose(); }}
                      className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600"
                    >
                      <RefreshCcw className="w-4 h-4 inline mr-2" />
                      Refrescar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Temas */}
            {activeTab === 'temas' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#f5f5f5' : '#1f2937' }}>Temas Personalizados</h3>

                <div className="grid grid-cols-2 gap-4">
                  {themeOptions.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`p-6 rounded-xl border-2 transition-all
                                 ${theme === t.id
                                   ? 'border-violet-500 ring-2 ring-violet-500/30'
                                   : ''}`}
                      style={{ borderColor: theme === t.id ? '#8b5cf6' : (theme === 'dark' ? '#374151' : '#e5e7eb') }}
                    >
                      <div
                        className="w-full h-20 rounded-lg mb-3 flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
                      >
                        <t.icon className={`w-8 h-8 ${t.id === 'dark' ? 'text-white' : 'text-gray-800'}`} />
                      </div>
                      <p className="font-medium" style={{ color: theme === t.id ? '#8b5cf6' : (theme === 'dark' ? '#d1d5db' : '#374151') }}>
                        {t.label}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-xl border" style={{
                  backgroundColor: theme === 'dark' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                  borderColor: theme === 'dark' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.3)'
                }}>
                  <p className="text-sm" style={{ color: theme === 'dark' ? '#fbbf24' : '#b45309' }}>
                    <Sparkles className="w-4 h-4 inline mr-2" />
                    Próximamente: más temas y colores personalizados
                  </p>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('tarjetas');
  const [resolvedPendientes, setResolvedPendientes] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('resolved_pendientes') || '[]'));
    } catch { return new Set(); }
  });

  // Onboarding state - mostrar solo si es la primera vez
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('onboarding_completed');
  });

  const handleOnboardingComplete = () => {
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
  const [proyeccionCuotas, setProyeccionCuotas] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [proyecciones, setProyecciones] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [reglas, setReglas] = useState([]);
  const [loading, setLoading] = useState(true);

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

    // También guardar en el backend si está disponible
    try {
      await fetch(`${API_BASE}/tarjetas/${tarjetaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_personalizado: nuevoNombre })
      });
    } catch (e) {
      console.log('No se pudo guardar en backend:', e);
    }
  };
  
  // Theme toggle
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  // Fetch all data from localStorage
  const fetchData = useCallback(async () => {
    console.log('[App] Iniciando fetchData...');
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
        if (n.includes('MASTERCARD')) return 'MASTERCARD';
        if (n.includes('VISA')) return 'VISA';
        if (n.includes('AMEX') || n.includes('AMERICAN')) return 'AMEX';
        if (n.includes('CABAL')) return 'CABAL';
        if (n.includes('NARANJA')) return 'NARANJA';
        return 'VISA';
      };

      // Leer datos de localStorage
      console.log('[App] Leyendo storage...');
      const resumenesData = storage.getResumenes();
      const movimientosData = storage.getMovimientos();
      let tarjetasData = storage.getTarjetas();

      // Corregir tarjetas con banco Desconocido
      let tarjetasActualizadas = false;
      tarjetasData = tarjetasData.map(t => {
        if (!t.banco || t.banco === 'Desconocido') {
          const bancoDet = detectarBanco(t.nombre);
          if (bancoDet) {
            tarjetasActualizadas = true;
            return { ...t, banco: bancoDet, tipo: t.tipo || detectarTipo(t.nombre) };
          }
        }
        return t;
      });
      if (tarjetasActualizadas) {
        localStorage.setItem('tarjetas_lista', JSON.stringify(tarjetasData));
      }
      const reglasData = storage.getReglas();
      const estadisticas = storage.getEstadisticas();
      const evolucion = storage.getEvolucionMensual(6);
      const proyeccionData = storage.getProyeccionCuotas(6);
      console.log('[App] Datos cargados:', {
        resumenes: resumenesData.length,
        tarjetas: tarjetasData.length,
        movimientos: movimientosData.length,
        estadisticas
      });

      // Obtener el último resumen de cada tarjeta
      const ultimoResumenPorTarjeta = {};
      resumenesData.forEach(r => {
        const key = r.tarjeta;
        if (!ultimoResumenPorTarjeta[key] ||
            r.anio > ultimoResumenPorTarjeta[key].anio ||
            (r.anio === ultimoResumenPorTarjeta[key].anio && r.mes > ultimoResumenPorTarjeta[key].mes)) {
          ultimoResumenPorTarjeta[key] = r;
        }
      });

      // Filtrar solo movimientos del último resumen de cada tarjeta
      const movimientosUltimoResumen = movimientosData.filter(m => {
        const ultimoResumen = ultimoResumenPorTarjeta[m.tarjeta];
        if (!ultimoResumen) return false;
        return m.resumen_id === ultimoResumen.id;
      });

      // Calcular cuotas activas: solo del último resumen y detectar por es_cuota o cuota_texto
      const cuotasActivasData = movimientosUltimoResumen.filter(m => {
        // Si tiene es_cuota explícito
        if (m.es_cuota && m.cuota_actual && m.total_cuotas) {
          return true;
        }
        // Si tiene cuota_texto (formato "2/6", "3/12", etc.) - usado por pdf-parser
        if (m.cuota_texto) {
          const match = m.cuota_texto.match(/(\d+)\/(\d+)/);
          if (match) {
            m.cuota_actual = parseInt(match[1]);
            m.total_cuotas = parseInt(match[2]);
            m.es_cuota = true;
            return true;
          }
        }
        return false;
      });

      // Enriquecer tarjetas con último resumen y estadísticas
      const tarjetasEnriquecidas = tarjetasData.map((t, idx) => {
        // Buscar último resumen de esta tarjeta
        const resumenesOrdenados = resumenesData
          .filter(r => r.tarjeta === t.nombre)
          .sort((a, b) => {
            if (a.anio !== b.anio) return b.anio - a.anio;
            return b.mes - a.mes;
          });
        const ultimoResumen = resumenesOrdenados[0] || null;

        // Calcular estadísticas de movimientos para esta tarjeta
        const movimientosTarjeta = movimientosData.filter(m => m.tarjeta === t.nombre);

        // Calcular estadísticas de cuotas para esta tarjeta
        const cuotasTarjeta = cuotasActivasData.filter(c => c.tarjeta === t.nombre);
        const montoCuotasPendientes = cuotasTarjeta.reduce((sum, c) => {
          const restantes = c.total_cuotas - c.cuota_actual;
          return sum + (c.monto_pesos || 0) * restantes;
        }, 0);

        // Cantidad de cuotas activas de esta tarjeta (sin agrupar por referencia)
        const comprasEnCuotasUnicas = cuotasTarjeta.length;

        return {
          ...t,
          id: t.id || idx + 1, // Asegurar que tenga ID
          ultimo_resumen: ultimoResumen ? {
            total_a_pagar: ultimoResumen.total_a_pagar_pesos,
            total_a_pagar_dolares: ultimoResumen.total_a_pagar_dolares || 0,
            total_consumos_pesos: ultimoResumen.total_consumos_pesos,
            total_consumos_dolares: ultimoResumen.total_consumos_dolares || 0,
            fecha_cierre: ultimoResumen.fecha_cierre,
            fecha_vencimiento: ultimoResumen.fecha_vencimiento,
            mes: ultimoResumen.mes,
            anio: ultimoResumen.anio,
            cantidad_movimientos: ultimoResumen.cantidad_movimientos
          } : null,
          estadisticas: {
            total_movimientos: movimientosTarjeta.length,
            compras_en_cuotas: comprasEnCuotasUnicas,
            monto_cuotas_pendientes: montoCuotasPendientes,
            cantidad_cuotas: cuotasTarjeta.length
          }
        };
      });

      // Transformar cuotas al formato esperado por CuotasView
      const cuotasFormateadas = cuotasActivasData.map(m => ({
        id: m.id,
        descripcion: m.referencia_limpia || m.referencia_original || 'Sin descripción',
        tarjeta: m.tarjeta,
        total_cuotas: m.total_cuotas,
        cuotas_pagadas: m.cuota_actual,
        cuotas_restantes: m.total_cuotas - m.cuota_actual,
        monto_cuota: m.monto_pesos || m.monto_dolares || 0,
        monto_total: (m.monto_pesos || m.monto_dolares || 0) * m.total_cuotas,
        es_ultima_cuota: m.cuota_actual === m.total_cuotas,
        fecha_compra: m.fecha_compra
      }));

      setTarjetas(tarjetasEnriquecidas);
      setMovimientos(movimientosData);
      setResumenes(resumenesData);
      setCuotasActivas(cuotasFormateadas);
      // Calcular totales de cuotas pendientes
      const totalPendienteCuotas = cuotasFormateadas.reduce((sum, c) => {
        return sum + (c.monto_cuota * c.cuotas_restantes);
      }, 0);

      setDashboard({
        // Propiedades en el nivel raíz para las cards
        total_resumenes: estadisticas.total_resumenes || resumenesData.length,
        total_a_pagar: estadisticas.total_a_pagar,
        total_a_pagar_dolares: estadisticas.total_a_pagar_dolares,
        total_tarjetas: estadisticas.total_tarjetas || tarjetasData.length,
        total_movimientos: estadisticas.total_movimientos || movimientosData.length,
        cuotas_activas: cuotasActivasData.length,
        pagos_pendientes: cuotasActivasData.reduce((sum, m) => sum + (m.total_cuotas - m.cuota_actual), 0),
        total_pendiente_cuotas: totalPendienteCuotas,
        ultimo_resumen: estadisticas.ultimo_resumen,
        // También mantener estadisticas para compatibilidad
        estadisticas: {
          total_a_pagar: estadisticas.total_a_pagar,
          total_a_pagar_dolares: estadisticas.total_a_pagar_dolares,
          total_tarjetas: estadisticas.total_tarjetas,
          total_movimientos: estadisticas.total_movimientos,
          cuotas_activas: estadisticas.cuotas_activas
        }
      });
      setProyecciones({ evolucion_mensual: evolucion });
      // Calcular pendientes desde movimientos dudosos (excluyendo los ya resueltos)
      const resolved = JSON.parse(localStorage.getItem('resolved_pendientes') || '[]');
      const resolvedSet = new Set(resolved);
      const movimientosDudosos = movimientosData.filter(m => m.es_dudoso);
      const pendientesUnicos = [];
      const refVistas = new Set();
      movimientosDudosos.forEach(m => {
        const refNorm = (m.referencia_original || '').toLowerCase().replace(/[^a-z]/g, '').substring(0, 20);
        // Excluir si ya fue resuelto (por ID o por referencia normalizada)
        if (resolvedSet.has(m.id) || resolvedSet.has(refNorm)) return;
        if (!refVistas.has(refNorm)) {
          refVistas.add(refNorm);
          pendientesUnicos.push({
            id: m.id,
            referencia_original: m.referencia_original,
            sugerencias: m.sugerencias || [],
            tarjeta: m.tarjeta,
            monto: m.monto_pesos || m.monto_dolares,
            refNorm: refNorm // Guardar para usar al resolver
          });
        }
      });
      setPendientes(pendientesUnicos);
      setReglas(reglasData);

      // Calcular proyección de cuotas desde cuotasActivasData (datos correctos del último resumen)
      const ahora = new Date();
      const proyeccionCalculada = [];
      for (let i = 0; i < 6; i++) {
        const fecha = new Date(ahora.getFullYear(), ahora.getMonth() + i, 1);
        let totalMes = 0;
        let cantidadCuotas = 0;

        cuotasActivasData.forEach(m => {
          const cuotasFaltantes = m.total_cuotas - m.cuota_actual;
          // Si aún quedan cuotas para este mes futuro
          if (cuotasFaltantes >= i) {
            totalMes += m.monto_pesos || 0;
            cantidadCuotas++;
          }
        });

        proyeccionCalculada.push({
          mes: fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
          mes_nombre: fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
          total: totalMes,
          cantidad_cuotas: cantidadCuotas
        });
      }
      setProyeccionCuotas(proyeccionCalculada);
    } catch (error) {
      console.error('[App] Error loading data from localStorage:', error);
    }
    setLoading(false);
    console.log('[App] fetchData completado');
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Calcular reintegros
  const reintegros = movimientos.filter(m =>
    m.monto_pesos < 0 ||
    m.monto_dolares < 0 ||
    /reintegro|devoluci[oó]n|cr[eé]dito|bonificaci[oó]n/i.test(m.referencia_original || m.referencia_limpia || '')
  );

  // Menu items
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'movimientos', icon: Receipt, label: 'Movimientos' },
    { id: 'cuotas', icon: Calendar, label: 'Cuotas', badge: cuotasActivas.length },
    { id: 'reintegros', icon: RefreshCcw, label: 'Reintegros', badge: reintegros.length > 0 ? reintegros.length : null },
    { id: 'importar', icon: Upload, label: 'Importar' },
  ];
  
  // Format currency (usa las funciones helper globales)
  const formatCurrency = (amount, currency = 'ARS') => {
    if (currency === 'USD') {
      return formatMontoDolares(amount);
    }
    return formatMonto(amount);
  };
  
  // Chart colors based on theme
  const chartColors = theme === 'dark' 
    ? ['#D4AF37', '#FFD700', '#F59E0B', '#FBBF24']
    : ['#8B5CF6', '#EC4899', '#06B6D4', '#10B981'];

  // Mostrar Onboarding si es la primera vez
  if (showOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Animated Background */}
      <div className="animated-bg" />

      {/* Sidebar */}
      <aside className={`sidebar fixed lg:relative w-72 h-screen flex flex-col z-40 transition-all duration-300
                        ${sidebarOpen ? 'left-0' : '-left-72 lg:left-0 lg:w-20'}`}>
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] 
                          flex items-center justify-center shadow-lg">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in-left">
              <h1 className="font-bold text-lg text-[var(--text-primary)]">Tarjeteando</h1>
              <p className="text-xs text-[var(--text-muted)]">Control financiero</p>
            </div>
          )}
        </div>
        
        {/* Menu */}
        <nav className="flex-1 px-4 py-2">
          {menuItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`menu-item w-full mb-1 ${activeView === item.id ? 'active' : ''}`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <item.icon className="w-5 h-5" />
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="badge">{item.badge}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>
        
        {/* Theme Toggle */}
        <div className="p-4 border-t border-[var(--glass-border)]">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-full flex items-center justify-center p-3 rounded-xl
                       bg-[var(--glass-bg)] hover:bg-opacity-80 transition-all"
          >
            <div className="flex items-center gap-2">
              <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-[var(--accent-1)]' : 'text-[var(--text-muted)]'}`} />
              <div className="theme-toggle" />
              <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-[var(--accent-1)]' : 'text-[var(--text-muted)]'}`} />
            </div>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 glass mx-4 mt-4 mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl hover:bg-[var(--glass-bg)] transition-colors lg:hidden"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {menuItems.find(m => m.id === activeView)?.label || 'Dashboard'}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {new Date().toLocaleDateString('es-AR', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl 
                              bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                <Search className="w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none text-sm w-40 text-[var(--text-primary)]
                             placeholder:text-[var(--text-muted)]"
                />
              </div>
              
              {/* Notifications */}
              <div className="relative">
                {(() => {
                  const unreadCount = pendientes.filter(p => !readNotifications.has(p.id)).length;
                  return (
                    <>
                      <button
                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                        className="relative p-2.5 rounded-xl bg-[var(--glass-bg)]
                                   border border-[var(--glass-border)] hover:bg-opacity-80 transition-all"
                      >
                        <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full
                                           bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)]
                                           text-white text-xs flex items-center justify-center font-bold">
                            {unreadCount}
                          </span>
                        )}
                      </button>

                      {/* Dropdown de notificaciones */}
                      {notificationsOpen && (
                        <div className="absolute right-0 top-12 w-80 glass-card p-4 z-50 shadow-xl">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-[var(--text-primary)]">Pendientes de resolver</h4>
                            <button
                              onClick={() => setNotificationsOpen(false)}
                              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {pendientes.length === 0 ? (
                            <p className="text-sm text-[var(--text-muted)] text-center py-4">
                              No hay pendientes
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {pendientes.slice(0, 5).map((p) => {
                                const isRead = readNotifications.has(p.id);
                                return (
                                  <div
                                    key={p.id}
                                    onClick={() => {
                                      setReadNotifications(prev => new Set([...prev, p.id]));
                                      setSettingsInitialTab('reglas');
                                      setSettingsOpen(true);
                                      setNotificationsOpen(false);
                                    }}
                                    className={`p-3 rounded-lg cursor-pointer transition-all
                                               ${isRead
                                                 ? 'bg-[var(--glass-bg)]/50 opacity-60'
                                                 : 'bg-[var(--glass-bg)] hover:bg-opacity-80'}`}
                                  >
                                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                      {p.referencia_original}
                                    </p>
                                    {p.sugerencias?.length > 0 && (
                                      <p className="text-xs text-[var(--text-muted)] truncate">
                                        Sugerencia: {p.sugerencias[0]}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                              {pendientes.length > 5 && (
                                <p className="text-xs text-center text-[var(--text-muted)] pt-2">
                                  +{pendientes.length - 5} más
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2 mt-3">
                            {unreadCount > 0 && (
                              <button
                                onClick={() => {
                                  setReadNotifications(new Set(pendientes.map(p => p.id)));
                                }}
                                className="flex-1 py-2 text-xs font-medium text-[var(--text-muted)]
                                           hover:bg-[var(--glass-bg)] rounded-lg transition-all"
                              >
                                Marcar leídas
                              </button>
                            )}
                            {pendientes.length > 0 && (
                              <button
                                onClick={() => {
                                  setSettingsInitialTab('reglas');
                                  setSettingsOpen(true);
                                  setNotificationsOpen(false);
                                }}
                                className="flex-1 py-2 text-sm font-medium text-[var(--accent-1)]
                                           hover:bg-[var(--glass-bg)] rounded-lg transition-all"
                              >
                                Resolver →
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              
              {/* Settings */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2.5 rounded-xl bg-[var(--glass-bg)]
                           border border-[var(--glass-border)] hover:bg-opacity-80 transition-all"
              >
                <Settings className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>
          </div>

        </header>
        
        {/* Content Area */}
        <div className="px-4 pb-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--accent-1)] border-t-transparent" />
            </div>
          ) : activeView === 'dashboard' ? (
            <DashboardView
              dashboard={{...dashboard, total_reintegros: reintegros.reduce((sum, r) => sum + Math.abs(r.monto_pesos || 0), 0)}}
              tarjetas={tarjetas}
              proyecciones={proyecciones}
              proyeccionCuotas={proyeccionCuotas}
              chartColors={chartColors}
              formatCurrency={formatCurrency}
              theme={theme}
              resumenes={resumenes}
              onDeleteResumen={fetchData}
              setActiveView={setActiveView}
              searchQuery={searchQuery}
              movimientos={movimientos}
              cuotasActivas={cuotasActivas}
              nombresTarjetas={nombresTarjetas}
              onGuardarNombre={guardarNombreTarjeta}
            />
          ) : activeView === 'movimientos' ? (
            <MovimientosView
              movimientos={movimientos}
              tarjetas={tarjetas}
              searchQuery={searchQuery}
              formatCurrency={formatCurrency}
            />
          ) : activeView === 'cuotas' ? (
            <CuotasView
              cuotas={cuotasActivas}
              formatCurrency={formatCurrency}
              searchQuery={searchQuery}
            />
          ) : activeView === 'reintegros' ? (
            <ReintegrosView
              reintegros={reintegros}
              formatCurrency={formatCurrency}
              searchQuery={searchQuery}
            />
          ) : activeView === 'importar' ? (
            <ImportarView onSuccess={fetchData} />
          ) : null}
        </div>
      </main>

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
        theme={theme}
        setTheme={setTheme}
        initialTab={settingsInitialTab}
        pendientes={pendientes}
        onResolvePendiente={(id, refNorm) => {
          // Guardar en localStorage los pendientes resueltos
          const resolved = JSON.parse(localStorage.getItem('resolved_pendientes') || '[]');
          if (!resolved.includes(id)) resolved.push(id);
          if (refNorm && !resolved.includes(refNorm)) resolved.push(refNorm);
          localStorage.setItem('resolved_pendientes', JSON.stringify(resolved));
          // Actualizar estado local inmediatamente
          setPendientes(prev => prev.filter(p => p.id !== id));
          setResolvedPendientes(new Set(resolved));
        }}
      />
    </div>
  );
};

// Dashboard View
const DashboardView = ({ dashboard, tarjetas, proyecciones, proyeccionCuotas = [], chartColors, formatCurrency, theme, resumenes = [], onDeleteResumen, setActiveView, searchQuery = '', movimientos = [], cuotasActivas = [], nombresTarjetas = {}, onGuardarNombre }) => {
  const [showResumenes, setShowResumenes] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleDeleteResumen = async (resumenId) => {
    if (!confirm('¿Eliminar este resumen y todos sus movimientos?')) return;
    setDeletingId(resumenId);
    try {
      storage.deleteResumen(resumenId);
      onDeleteResumen?.();
    } catch (error) {
      console.error('Error eliminando resumen:', error);
    }
    setDeletingId(null);
  };

  // Búsqueda global
  const query = searchQuery.toLowerCase();
  const searchResults = query ? {
    movimientos: movimientos.filter(m =>
      m.referencia_limpia?.toLowerCase().includes(query) ||
      m.referencia_original?.toLowerCase().includes(query) ||
      m.tarjeta?.toLowerCase().includes(query)
    ).slice(0, 5),
    cuotas: cuotasActivas.filter(c =>
      c.descripcion?.toLowerCase().includes(query) ||
      c.tarjeta?.toLowerCase().includes(query)
    ).slice(0, 5),
    tarjetas: tarjetas.filter(t =>
      t.nombre?.toLowerCase().includes(query) ||
      t.banco?.toLowerCase().includes(query)
    )
  } : null;

  if (!dashboard) return <div className="text-center py-12 text-[var(--text-muted)]">No hay datos</div>;

  return (
    <div className="space-y-6">
      {/* Modal de Resúmenes */}
      {showResumenes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Resúmenes Cargados ({resumenes.length})
              </h3>
              <button
                onClick={() => setShowResumenes(false)}
                className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {resumenes.length === 0 ? (
                <p className="text-center text-[var(--text-muted)] py-8">No hay resúmenes cargados</p>
              ) : (
                <div className="space-y-3">
                  {resumenes.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-[var(--glass-bg)]"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-[var(--text-primary)]">{r.tarjeta}</p>
                        <p className="text-sm text-[var(--text-muted)]">
                          {new Date(r.anio, r.mes - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                          {' • '}{r.cantidad_movimientos} movimientos
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {formatMonto(r.total_a_pagar_pesos || 0)}
                        </span>
                        <button
                          onClick={() => handleDeleteResumen(r.id)}
                          disabled={deletingId === r.id}
                          className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30
                                     transition-all disabled:opacity-50"
                          title="Eliminar resumen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resultados de búsqueda */}
      {searchResults && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Resultados para "{searchQuery}"
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tarjetas encontradas */}
            {searchResults.tarjetas.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Tarjetas ({searchResults.tarjetas.length})</h4>
                <div className="space-y-2">
                  {searchResults.tarjetas.map(t => (
                    <div key={t.id} className="p-3 rounded-lg bg-[var(--glass-bg)]">
                      <p className="font-medium text-[var(--text-primary)]">{t.nombre}</p>
                      <p className="text-xs text-[var(--text-muted)]">{t.banco}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Movimientos encontrados */}
            {searchResults.movimientos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">
                  Movimientos ({searchResults.movimientos.length > 5 ? '5+' : searchResults.movimientos.length})
                </h4>
                <div className="space-y-2">
                  {searchResults.movimientos.map((m, i) => (
                    <div key={m.id || i} className="p-3 rounded-lg bg-[var(--glass-bg)]">
                      <p className="font-medium text-[var(--text-primary)] text-sm truncate">
                        {m.referencia_limpia || m.referencia_original}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {m.tarjeta} • {formatCurrency(m.monto_pesos)}
                      </p>
                    </div>
                  ))}
                  {searchResults.movimientos.length >= 5 && (
                    <button
                      onClick={() => setActiveView?.('movimientos')}
                      className="text-sm text-[var(--accent-1)] hover:underline"
                    >
                      Ver más en Movimientos →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Cuotas encontradas */}
            {searchResults.cuotas.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">
                  Cuotas ({searchResults.cuotas.length > 5 ? '5+' : searchResults.cuotas.length})
                </h4>
                <div className="space-y-2">
                  {searchResults.cuotas.map((c, i) => (
                    <div key={c.id || i} className="p-3 rounded-lg bg-[var(--glass-bg)]">
                      <p className="font-medium text-[var(--text-primary)] text-sm truncate">{c.descripcion}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {c.tarjeta} • {c.cuotas_pagadas}/{c.total_cuotas}
                      </p>
                    </div>
                  ))}
                  {searchResults.cuotas.length >= 5 && (
                    <button
                      onClick={() => setActiveView?.('cuotas')}
                      className="text-sm text-[var(--accent-1)] hover:underline"
                    >
                      Ver más en Cuotas →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {searchResults.tarjetas.length === 0 && searchResults.movimientos.length === 0 && searchResults.cuotas.length === 0 && (
            <p className="text-center text-[var(--text-muted)] py-4">No se encontraron resultados</p>
          )}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Resúmenes"
          value={dashboard.total_resumenes || 0}
          delay={100}
          onClick={() => setShowResumenes(true)}
        />
        <StatCard
          icon={Calendar}
          label="Cuotas Activas"
          value={dashboard.cuotas_activas || 0}
          delay={200}
          onClick={() => setActiveView?.('cuotas')}
        />
        <StatCard
          icon={DollarSign}
          label="Pendiente Cuotas"
          value={formatCurrency(dashboard.total_pendiente_cuotas || 0)}
          trend="down"
          trendValue="Próx. mes"
          delay={300}
        />
        <StatCard
          icon={RefreshCcw}
          label="Reintegros"
          value={formatCurrency(dashboard.total_reintegros || 0)}
          delay={400}
          onClick={() => setActiveView?.('reintegros')}
        />
      </div>
      
      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {tarjetas.map((tarjeta, idx) => (
          <div 
            key={tarjeta.id}
            className="opacity-0 animate-fade-in-up"
            style={{ animationDelay: `${500 + idx * 100}ms`, animationFillMode: 'forwards' }}
          >
            <CreditCardVisual
              tarjeta={tarjeta}
              stats={tarjeta}
              nombrePersonalizado={nombresTarjetas[tarjeta.id]}
              onEditarNombre={onGuardarNombre}
            />
          </div>
        ))}
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution Chart - Una línea por tarjeta */}
        <div className="glass-card p-6 opacity-0 animate-fade-in-up"
             style={{ animationDelay: '700ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Evolución Mensual</h3>
              <p className="text-sm text-[var(--text-muted)]">Por tarjeta</p>
            </div>
            <BarChart3 className="w-5 h-5 text-[var(--accent-1)]" />
          </div>

          {(() => {
            const evolucionData = proyecciones?.evolucion_mensual || proyecciones?.evolucion || [];
            // Obtener TODAS las tarjetas de TODOS los meses, excluyendo 'mes', 'anio' y 'total'
            const allKeys = new Set();
            evolucionData.forEach(item => {
              Object.keys(item).forEach(k => {
                if (k !== 'mes' && k !== 'anio' && k !== 'total') allKeys.add(k);
              });
            });
            const tarjetasEnGrafico = Array.from(allKeys);

            return (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={evolucionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--glass-border)' }}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--glass-border)' }}
                    tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px'
                    }}
                    formatter={(v, name) => [formatMonto(v || 0), name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  {tarjetasEnGrafico.map((tarjeta) => {
                    const color = getTarjetaColor(tarjeta);
                    return (
                      <Line
                        key={tarjeta}
                        type="monotone"
                        dataKey={tarjeta}
                        name={tarjeta}
                        stroke={color}
                        strokeWidth={2}
                        dot={{ fill: color, r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
        
        {/* By Card Chart */}
        <div className="glass-card p-6 opacity-0 animate-fade-in-up"
             style={{ animationDelay: '800ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Por Tarjeta</h3>
              <p className="text-sm text-[var(--text-muted)]">Distribución de gastos</p>
            </div>
            <PieChart className="w-5 h-5 text-[var(--accent-2)]" />
          </div>
          
          {(() => {
            const pieData = tarjetas.map((t) => ({
              name: t.nombre,
              value: t.ultimo_resumen?.total_a_pagar ||
                     t.ultimo_resumen?.total_consumos_pesos ||
                     t.estadisticas?.monto_cuotas_pendientes || 0
            })).filter(d => d.value > 0);

            return (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={getTarjetaColor(entry.name)} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px'
                    }}
                    formatter={(v) => [formatMonto(v), '']}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </div>

      {/* Proyección de Cuotas - Gastos Comprometidos */}
      {proyeccionCuotas && proyeccionCuotas.length > 0 && proyeccionCuotas.some(m => m.total > 0) && (
        <div className="glass-card p-6 opacity-0 animate-fade-in-up"
             style={{ animationDelay: '900ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Proyección de Cuotas</h3>
              <p className="text-sm text-[var(--text-muted)]">Gastos comprometidos próximos 6 meses</p>
            </div>
            <Calendar className="w-5 h-5 text-[var(--accent-1)]" />
          </div>

          {/* Resumen rápido */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--accent-1)]/20 to-[var(--accent-2)]/20 border border-[var(--accent-1)]/30">
              <p className="text-xs text-[var(--text-muted)] mb-1">Este mes</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {formatCurrency(proyeccionCuotas[0]?.total || 0)}
              </p>
              <p className="text-xs text-[var(--accent-1)]">{proyeccionCuotas[0]?.cantidad_cuotas || 0} cuotas</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--glass-bg)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Próximo mes</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {formatCurrency(proyeccionCuotas[1]?.total || 0)}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{proyeccionCuotas[1]?.cantidad_cuotas || 0} cuotas</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--glass-bg)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">En 3 meses</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {formatCurrency(proyeccionCuotas[2]?.total || 0)}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{proyeccionCuotas[2]?.cantidad_cuotas || 0} cuotas</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--glass-bg)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Total 6 meses</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {formatCurrency(proyeccionCuotas.reduce((s, m) => s + (m.total || 0), 0))}
              </p>
              <p className="text-xs text-[var(--text-muted)]">comprometidos</p>
            </div>
          </div>

          {/* Gráfico de barras */}
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={proyeccionCuotas.map(m => ({
              mes: m.mes_nombre?.split(' ')[0] || m.mes,
              total: m.total,
              cantidad: m.cantidad_cuotas
            }))} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis
                dataKey="mes"
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--glass-border)' }}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--glass-border)' }}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)'
                }}
                formatter={(v) => [formatMonto(v || 0), 'Total']}
              />
              <Bar
                dataKey="total"
                name="Cuotas"
                fill="url(#colorGradient)"
                radius={[4, 4, 0, 0]}
              />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-1)" />
                  <stop offset="100%" stopColor="var(--accent-2)" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// Movimientos View con paginación por mes y filtros
const MovimientosView = ({ movimientos, tarjetas = [], searchQuery, formatCurrency }) => {
  const [mesActual, setMesActual] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Estados de filtros
  const [filtroTarjeta, setFiltroTarjeta] = useState('');
  const [filtroBanco, setFiltroBanco] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroMoneda, setFiltroMoneda] = useState('');
  const [filtroCuotas, setFiltroCuotas] = useState('');

  // Obtener opciones únicas para los filtros
  const tarjetasUnicas = [...new Set(movimientos.map(m => m.tarjeta))].sort();
  const bancosUnicos = [...new Set(tarjetas.map(t => t.banco))].filter(Boolean).sort();

  // Limpiar todos los filtros
  const limpiarFiltros = () => {
    setFiltroTarjeta('');
    setFiltroBanco('');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setFiltroMoneda('');
    setFiltroCuotas('');
  };

  // Contar filtros activos
  const filtrosActivos = [filtroTarjeta, filtroBanco, filtroFechaDesde, filtroFechaHasta, filtroMoneda, filtroCuotas]
    .filter(Boolean).length;

  // Obtener meses únicos ordenados (más reciente primero)
  const mesesUnicos = [...new Set(movimientos.map(m => {
    const fecha = new Date(m.fecha_compra);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  }))].sort().reverse();

  const mesSeleccionado = mesesUnicos[mesActual] || mesesUnicos[0];

  // Filtrar movimientos
  const filtered = movimientos.filter(m => {
    // Filtro por mes (paginación)
    if (mesSeleccionado && !filtroFechaDesde && !filtroFechaHasta) {
      const fechaMov = new Date(m.fecha_compra);
      const mesMov = `${fechaMov.getFullYear()}-${String(fechaMov.getMonth() + 1).padStart(2, '0')}`;
      if (mesMov !== mesSeleccionado) return false;
    }

    // Filtro por búsqueda global
    if (searchQuery &&
        !m.referencia_limpia?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.referencia_original?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Filtro por tarjeta
    if (filtroTarjeta && m.tarjeta !== filtroTarjeta) return false;

    // Filtro por banco
    if (filtroBanco) {
      const tarjetaInfo = tarjetas.find(t => t.nombre === m.tarjeta);
      if (!tarjetaInfo || tarjetaInfo.banco !== filtroBanco) return false;
    }

    // Filtro por fecha desde
    if (filtroFechaDesde) {
      const fechaMov = new Date(m.fecha_compra);
      const fechaDesde = new Date(filtroFechaDesde);
      if (fechaMov < fechaDesde) return false;
    }

    // Filtro por fecha hasta
    if (filtroFechaHasta) {
      const fechaMov = new Date(m.fecha_compra);
      const fechaHasta = new Date(filtroFechaHasta);
      fechaHasta.setHours(23, 59, 59);
      if (fechaMov > fechaHasta) return false;
    }

    // Filtro por moneda
    if (filtroMoneda === 'ARS' && !(m.monto_pesos > 0)) return false;
    if (filtroMoneda === 'USD' && !(m.monto_dolares > 0)) return false;

    // Filtro por cuotas
    if (filtroCuotas === 'si' && !m.cuota_texto) return false;
    if (filtroCuotas === 'no' && m.cuota_texto) return false;

    return true;
  });

  // Detectar si es última cuota
  const esUltimaCuota = (cuotaTexto) => {
    if (!cuotaTexto) return false;
    const match = cuotaTexto.match(/(\d+)\/(\d+)/);
    return match && match[1] === match[2];
  };

  return (
    <div className="space-y-4">
      {/* Panel de filtros */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-[var(--text-primary)] font-medium"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {filtrosActivos > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--accent-1)] text-white">
                {filtrosActivos}
              </span>
            )}
          </button>

          {filtrosActivos > 0 && (
            <button
              onClick={limpiarFiltros}
              className="text-sm text-[var(--accent-1)] hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-[var(--glass-border)]">
            {/* Filtro por Tarjeta */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Tarjeta</label>
              <select
                value={filtroTarjeta}
                onChange={(e) => setFiltroTarjeta(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]
                           text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-1)]"
              >
                <option value="">Todas</option>
                {tarjetasUnicas.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Banco */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Banco</label>
              <select
                value={filtroBanco}
                onChange={(e) => setFiltroBanco(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]
                           text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-1)]"
              >
                <option value="">Todos</option>
                {bancosUnicos.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Filtro fecha desde */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Desde</label>
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]
                           text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-1)]"
              />
            </div>

            {/* Filtro fecha hasta */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Hasta</label>
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]
                           text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-1)]"
              />
            </div>

            {/* Filtro por Moneda */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Moneda</label>
              <select
                value={filtroMoneda}
                onChange={(e) => setFiltroMoneda(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]
                           text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-1)]"
              >
                <option value="">Todas</option>
                <option value="ARS">Pesos (ARS)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>

            {/* Filtro por Cuotas */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Cuotas</label>
              <select
                value={filtroCuotas}
                onChange={(e) => setFiltroCuotas(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]
                           text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-1)]"
              >
                <option value="">Todas</option>
                <option value="si">Con cuotas</option>
                <option value="no">Sin cuotas</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {filtered.length} movimientos
          </h3>
          {mesSeleccionado && !filtroFechaDesde && !filtroFechaHasta && (() => {
            const [anio, mesNum] = mesSeleccionado.split('-');
            const nombreMes = new Date(anio, parseInt(mesNum) - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            return (
              <span className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] text-white text-sm font-medium capitalize">
                {nombreMes}
              </span>
            );
          })()}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--glass-bg)]">
                <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Fecha</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Tarjeta</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Descripción</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Cuota</th>
                <th className="text-right p-4 text-sm font-medium text-[var(--text-muted)]">Monto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((mov, idx) => (
                <tr
                  key={mov.id || idx}
                  className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]
                             transition-colors opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(idx, 20) * 30}ms`, animationFillMode: 'forwards' }}
                >
                  <td className="p-4 text-sm text-[var(--text-secondary)]">
                    {new Date(mov.fecha_compra).toLocaleDateString('es-AR')}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[var(--glass-bg)]
                                     text-[var(--text-secondary)]">
                      {mov.tarjeta}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-[var(--text-primary)] font-medium">
                    {mov.referencia_limpia || mov.referencia_original}
                  </td>
                  <td className="p-4 text-sm">
                    {mov.cuota_texto ? (
                      esUltimaCuota(mov.cuota_texto) ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                        bg-gradient-to-r from-emerald-500/20 to-teal-500/20
                                        text-emerald-400 font-semibold border border-emerald-500/30">
                          <Trophy className="w-3.5 h-3.5" />
                          {mov.cuota_texto}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">{mov.cuota_texto}</span>
                      )
                    ) : (
                      <span className="text-[var(--text-muted)]">-</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {mov.monto_pesos > 0 && (
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrency(mov.monto_pesos)}
                      </span>
                    )}
                    {mov.monto_dolares > 0 && (
                      <span className="block text-sm font-medium text-emerald-500">
                        {formatCurrency(mov.monto_dolares, 'USD')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <p className="text-center text-sm text-[var(--text-muted)] py-4">
              Mostrando 100 de {filtered.length} movimientos. Usa los filtros para refinar.
            </p>
          )}
        </div>

        {/* Paginación por mes - solo si no hay filtros de fecha */}
        {mesesUnicos.length > 1 && !filtroFechaDesde && !filtroFechaHasta && (
          <div className="p-4 border-t border-[var(--glass-border)] flex items-center justify-between">
            <button
              onClick={() => setMesActual(prev => Math.min(prev + 1, mesesUnicos.length - 1))}
              disabled={mesActual >= mesesUnicos.length - 1}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--glass-bg)]
                         text-[var(--text-secondary)] hover:bg-opacity-80 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Mes Anterior
            </button>

            <div className="flex items-center gap-2">
              {mesesUnicos.slice(Math.max(0, mesActual - 2), mesActual + 3).map((mes) => {
                const [anio, mesNum] = mes.split('-');
                const nombreMes = new Date(anio, mesNum - 1).toLocaleDateString('es-AR', { month: 'short' });
                const isSelected = mes === mesSeleccionado;
                return (
                  <button
                    key={mes}
                    onClick={() => setMesActual(mesesUnicos.indexOf(mes))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                               ${isSelected
                                 ? 'bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)] text-white'
                                 : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-opacity-80'}`}
                  >
                    {nombreMes} {anio.slice(2)}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setMesActual(prev => Math.max(prev - 1, 0))}
              disabled={mesActual <= 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--glass-bg)]
                         text-[var(--text-secondary)] hover:bg-opacity-80 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mes Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Cuotas View con última cuota destacada
const CuotasView = ({ cuotas = [], formatCurrency, searchQuery = '' }) => {
  const cuotasArray = Array.isArray(cuotas) ? cuotas : [];

  // Filtrar por búsqueda global
  const filtered = cuotasArray.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return c.descripcion?.toLowerCase().includes(query) ||
           c.tarjeta?.toLowerCase().includes(query);
  });

  return (
    <div className="grid gap-4">
        {filtered.map((cuota, idx) => {
        const esUltimaCuota = cuota.es_ultima_cuota ||
                             cuota.cuotas_restantes === 0 ||
                             (cuota.cuotas_pagadas === cuota.total_cuotas);

        return (
          <div
            key={cuota.id || idx}
            className={`glass-card p-5 opacity-0 animate-fade-in-up transition-all
                       ${esUltimaCuota
                         ? 'ring-2 ring-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.3)] bg-gradient-to-r from-emerald-500/10 to-teal-500/10'
                         : ''}`}
            style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'forwards' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 flex items-center gap-3">
                {esUltimaCuota && (
                  <div className="p-2 rounded-full bg-emerald-500/20 animate-pulse">
                    <Trophy className="w-5 h-5 text-emerald-400" />
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    {cuota.descripcion}
                    {esUltimaCuota && (
                      <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                        ¡Última cuota!
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-[var(--text-muted)]">{cuota.tarjeta}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-[var(--text-muted)]">Progreso</p>
                  <p className={`font-semibold ${esUltimaCuota ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>
                    {cuota.cuotas_pagadas}/{cuota.total_cuotas}
                  </p>
                </div>

                <div className="w-32 h-2 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500
                               ${esUltimaCuota
                                 ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                                 : 'bg-gradient-to-r from-[var(--accent-1)] to-[var(--accent-2)]'}`}
                    style={{ width: `${(cuota.cuotas_pagadas / cuota.total_cuotas) * 100}%` }}
                  />
                </div>

                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">Por cuota</p>
                  <p className={`font-bold ${esUltimaCuota ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>
                    {formatCurrency(cuota.monto_cuota)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}

        {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{searchQuery ? 'No se encontraron cuotas' : 'No hay cuotas activas'}</p>
        </div>
      )}
    </div>
  );
};

// Reintegros View - Devoluciones y créditos
const ReintegrosView = ({ reintegros = [], formatCurrency, searchQuery = '' }) => {
  // Filtrar por búsqueda
  const filtered = reintegros.filter(r => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return r.referencia_limpia?.toLowerCase().includes(query) ||
           r.referencia_original?.toLowerCase().includes(query) ||
           r.tarjeta?.toLowerCase().includes(query);
  });

  // Calcular total de reintegros
  const totalPesos = filtered.reduce((sum, r) => sum + Math.abs(r.monto_pesos || 0), 0);
  const totalDolares = filtered.reduce((sum, r) => sum + Math.abs(r.monto_dolares || 0), 0);

  // Agrupar por tarjeta
  const porTarjeta = filtered.reduce((acc, r) => {
    const tarjeta = r.tarjeta || 'Sin tarjeta';
    if (!acc[tarjeta]) acc[tarjeta] = { pesos: 0, dolares: 0, count: 0 };
    acc[tarjeta].pesos += Math.abs(r.monto_pesos || 0);
    acc[tarjeta].dolares += Math.abs(r.monto_dolares || 0);
    acc[tarjeta].count++;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Resumen de reintegros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <RefreshCcw className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-sm text-[var(--text-muted)]">Total Reintegros</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{filtered.length}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-sm text-[var(--text-muted)]">Total en Pesos</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{formatCurrency(totalPesos)}</p>
        </div>

        {totalDolares > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-sm text-[var(--text-muted)]">Total en USD</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">{formatCurrency(totalDolares, 'USD')}</p>
          </div>
        )}
      </div>

      {/* Por tarjeta */}
      {Object.keys(porTarjeta).length > 1 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Por Tarjeta</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(porTarjeta).map(([tarjeta, data]) => (
              <div key={tarjeta} className="p-3 rounded-lg bg-[var(--glass-bg)]">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{tarjeta}</p>
                <p className="text-lg font-bold text-emerald-500">{formatCurrency(data.pesos)}</p>
                <p className="text-xs text-[var(--text-muted)]">{data.count} reintegros</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de reintegros */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-[var(--glass-border)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Detalle de Reintegros ({filtered.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--glass-bg)]">
                <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Fecha</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Tarjeta</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Descripción</th>
                <th className="text-right p-4 text-sm font-medium text-[var(--text-muted)]">Monto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mov, idx) => (
                <tr
                  key={mov.id || idx}
                  className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]
                             transition-colors opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(idx, 20) * 30}ms`, animationFillMode: 'forwards' }}
                >
                  <td className="p-4 text-sm text-[var(--text-secondary)]">
                    {new Date(mov.fecha_compra).toLocaleDateString('es-AR')}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[var(--glass-bg)]
                                     text-[var(--text-secondary)]">
                      {mov.tarjeta}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-[var(--text-primary)] font-medium">
                    {mov.referencia_limpia || mov.referencia_original}
                  </td>
                  <td className="p-4 text-right">
                    {mov.monto_pesos !== 0 && (
                      <span className="text-sm font-semibold text-emerald-500">
                        +{formatCurrency(Math.abs(mov.monto_pesos))}
                      </span>
                    )}
                    {mov.monto_dolares !== 0 && (
                      <span className="block text-sm font-medium text-emerald-400">
                        +{formatCurrency(Math.abs(mov.monto_dolares), 'USD')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <RefreshCcw className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay reintegros registrados</p>
          </div>
        )}
      </div>
    </div>
  );
};

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
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-[var(--text-primary)]">
              Nombres pendientes de resolver ({filteredPendientes.length})
            </h3>
          </div>

          <div className="space-y-3">
            {filteredPendientes.map((p, idx) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-[var(--glass-bg)] opacity-0 animate-fade-in-up"
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'forwards' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-[var(--text-primary)]">{p.referencia_original}</p>
                    {p.sugerencias?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.sugerencias.map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => { setEditingId(p.id); setNombreLimpio(sug); }}
                            className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-1)]/20
                                       text-[var(--accent-1)] hover:bg-[var(--accent-1)]/30 transition-all"
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
                        className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 transition-all"
                        title="Resolver"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleIgnorar(p.id)}
                        disabled={loading}
                        className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-all
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
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]
                                 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-1)]"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleResolver(p.id)}
                    />
                    <button
                      onClick={() => handleResolver(p.id)}
                      disabled={loading || !nombreLimpio.trim()}
                      className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium
                                 hover:bg-emerald-600 transition-all disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setNombreLimpio(''); }}
                      className="px-3 py-2 rounded-lg bg-[var(--glass-bg)] text-[var(--text-muted)]
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
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">
          Reglas de limpieza ({filteredReglas.length})
          {reglasUnicas.length < reglas.length && (
            <span className="text-xs text-[var(--text-muted)] ml-2">
              ({reglas.length - reglasUnicas.length} duplicadas eliminadas)
            </span>
          )}
        </h3>

        <div className="space-y-3">
          {filteredReglas.map((regla, idx) => (
            <div
              key={regla.id || idx}
              className="flex items-center justify-between p-4 rounded-xl bg-[var(--glass-bg)]
                         opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'forwards' }}
            >
              <div className="flex items-center gap-4">
                <Tag className="w-4 h-4 text-[var(--accent-1)]" />
                <div>
                  <code className="text-sm text-[var(--text-muted)]">{regla.patron}</code>
                  <p className="font-medium text-[var(--text-primary)]">→ {regla.nombre_limpio}</p>
                </div>
              </div>
              <span className="text-sm text-[var(--text-muted)]">
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
const ImportarView = ({ onSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [results, setResults] = useState([]);
  
  const handleUpload = async (files) => {
    if (!files.length) return;

    setUploading(true);
    setResults([]);

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('pdfs', file);
    });

    try {
      const response = await fetch(`${API_BASE}/resumenes/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      console.log('[Upload] Respuesta del servidor:', data);

      // Guardar cada resultado exitoso en localStorage
      const resultados = data.data?.resultados || data.resultados || [];
      console.log('[Upload] Resultados a procesar:', resultados);
      for (const resultado of resultados) {
        console.log('[Upload] Procesando resultado:', resultado);
        if (resultado.exito && resultado.datos) {
          const { resumen, movimientos, tarjeta } = resultado.datos;
          console.log('[Upload] Guardando datos:', { tarjeta, resumen, movimientosCount: movimientos?.length });

          // Guardar tarjeta (detectar banco desde nombre si no viene en resumen)
          if (tarjeta) {
            let banco = resumen?.banco;
            let tipo = resumen?.tipo;
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
              if (n.includes('MASTERCARD')) tipo = 'MASTERCARD';
              else if (n.includes('VISA')) tipo = 'VISA';
              else if (n.includes('AMEX')) tipo = 'AMEX';
              else tipo = 'VISA';
            }
            storage.saveTarjeta({
              nombre: tarjeta,
              banco: banco || 'Desconocido',
              tipo: tipo
            });
          }

          // Guardar resumen
          if (resumen) {
            const resumenId = `${tarjeta}-${resumen.anio}-${resumen.mes}`;
            const resumenData = {
              id: resumenId,
              tarjeta: tarjeta,
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
            };
            console.log('[Upload] Guardando resumen:', resumenData);
            storage.saveResumen(resumenData);

            // Guardar movimientos
            if (movimientos && movimientos.length > 0) {
              console.log('[Upload] Guardando', movimientos.length, 'movimientos para', tarjeta);
              storage.saveMovimientos(resumenId, movimientos, tarjeta);
            }
          }
        }
      }

      setResults(resultados);
      onSuccess?.();
    } catch (error) {
      console.error('Upload error:', error);
      setResults([{ archivo: 'Error', exito: false, error: error.message }]);
    }

    setUploading(false);
  };
  
  return (
    <div className="max-w-2xl mx-auto">
      <div 
        className={`glass-card p-12 text-center border-2 border-dashed transition-all cursor-pointer
                    ${dragOver ? 'border-[var(--accent-1)] bg-[var(--accent-1)]/10' : 'border-[var(--glass-border)]'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />

        {uploading ? (
          <div className="animate-pulse">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-[var(--accent-1)]" />
            <p className="text-lg font-medium text-[var(--text-primary)]">Procesando...</p>
          </div>
        ) : (
          <>
            <Upload className="w-16 h-16 mx-auto mb-4 text-[var(--accent-1)] opacity-70" />
            <p className="text-lg font-medium text-[var(--text-primary)] mb-2">
              Arrastrá tus resúmenes aquí
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              PDF o screenshots (PNG, JPG, WebP)
            </p>
          </>
        )}
      </div>
      
      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6 space-y-3">
          {results.map((r, idx) => (
            <div 
              key={idx}
              className={`glass-card p-4 flex items-center gap-3 opacity-0 animate-fade-in-up
                         ${r.exito ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'}`}
              style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'forwards' }}
            >
              {r.exito ? (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <div className="flex-1">
                <p className="font-medium text-[var(--text-primary)]">{r.archivo}</p>
                {r.error && <p className="text-sm text-red-400">{r.error}</p>}
                {r.movimientos && (
                  <p className="text-sm text-[var(--text-muted)]">
                    {r.movimientos} movimientos importados
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
// Build 1769553006
