import React, { useState, useEffect, useCallback } from 'react';
import storage from './services/storage';
import {
  LayoutDashboard, Receipt, CreditCard, Tag, Upload,
  TrendingUp, TrendingDown, Calendar, AlertCircle, ChevronRight,
  Sun, Moon, Bell, Settings, Search, Menu, X, DollarSign,
  PieChart, BarChart3, Wallet, ArrowUpRight, ArrowDownRight,
  FileText, Clock, CheckCircle, XCircle, Sparkles, Trophy, Filter,
  RefreshCcw, Trash2, Download, Edit3, Plus, Repeat, Shuffle
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
          <h2 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent mb-3">Bienvenido a Tarjeteando</h2>
          <p className="text-gray-600 max-w-md mx-auto text-lg">
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
          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-3">Subi tu primer resumen</h2>
          <p className="text-gray-600 max-w-md mx-auto mb-4 text-lg">
            Arrastra el PDF de tu resumen de tarjeta o hace click para seleccionarlo.
            Soportamos VISA, Mastercard y American Express de los principales bancos argentinos.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {['Galicia', 'Macro', 'Santander', 'BBVA', 'HSBC', 'ICBC'].map((banco, idx) => (
              <span key={banco} className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 text-sm font-medium text-violet-700 border border-violet-200 shadow-sm">
                {banco}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl px-4 py-3 max-w-md mx-auto border border-amber-200">
            <Clock className="w-5 h-5 flex-shrink-0 text-amber-500" />
            <p className="text-sm font-medium">La primera carga puede tardar unos segundos mientras procesamos el PDF</p>
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
          <h2 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent mb-4">Tips y funcionalidades</h2>
          <div className="space-y-3 max-w-md mx-auto text-left">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Subi todos tus resumenes</p>
                <p className="text-xs text-gray-600">Carga varios meses para ver el historial completo y mejores proyecciones</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                <Edit3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Renombra comercios</p>
                <p className="text-xs text-gray-600">Podes asignar nombres claros a comercios con nombres confusos desde Configuracion</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Tus datos son privados</p>
                <p className="text-xs text-gray-600">Todo se guarda en tu navegador. No almacenamos tus resumenes en ningun servidor</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentStep = steps[step - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
      {/* Animated Background with particles effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '1s'}} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{animationDelay: '2s'}} />
      </div>

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 animate-fade-in-up border border-white/20">
        {/* Progress Bar */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2.5 rounded-full transition-all duration-500 ${
                idx + 1 === step
                  ? 'w-12 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 shadow-lg shadow-violet-500/30'
                  : idx + 1 < step
                    ? 'w-12 bg-gradient-to-r from-emerald-400 to-teal-400'
                    : 'w-3 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px] flex items-center justify-center">
          {currentStep.content}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
              step === 1
                ? 'opacity-0 pointer-events-none'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            Anterior
          </button>

          <span className="text-sm font-medium text-gray-400">
            Paso {step} de {steps.length}
          </span>

          {step < steps.length ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all hover:scale-105"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all hover:scale-105"
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

// ==================== GASTOS FIJOS/VARIABLES ====================
// Analiza movimientos para detectar gastos fijos (recurrentes mensuales con monto similar)
// Criterio: mismo comercio aparece 3+ meses con variación de monto <= 5%
const analizarGastosFijosVariables = (movimientos) => {
  if (!movimientos || movimientos.length === 0) {
    return { gastosFijos: new Set(), analisis: {} };
  }

  // Agrupar por comercio (referencia_limpia o referencia_original)
  const porComercio = {};

  movimientos.forEach(mov => {
    const nombre = (mov.referencia_limpia || mov.referencia_original || '').toLowerCase().trim();
    if (!nombre || nombre.length < 3) return;

    // Extraer mes/año del movimiento
    const fecha = new Date(mov.fecha_compra);
    const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    const monto = mov.monto_pesos || 0;

    if (monto <= 0) return; // Ignorar devoluciones

    if (!porComercio[nombre]) {
      porComercio[nombre] = { meses: {}, montos: [] };
    }

    // Guardar el monto más alto de cada mes (por si hay múltiples cargos)
    if (!porComercio[nombre].meses[mesKey] || porComercio[nombre].meses[mesKey] < monto) {
      porComercio[nombre].meses[mesKey] = monto;
    }
  });

  // Analizar cada comercio
  const gastosFijos = new Set();
  const analisis = {};

  Object.entries(porComercio).forEach(([nombre, data]) => {
    const mesesUnicos = Object.keys(data.meses).sort();
    const montos = mesesUnicos.map(m => data.meses[m]);

    // Necesita aparecer en al menos 3 meses (más estricto)
    if (mesesUnicos.length < 3) {
      analisis[nombre] = { tipo: 'variable', razon: 'menos de 3 meses', meses: mesesUnicos.length };
      return;
    }

    // Calcular variación entre montos
    const montoPromedio = montos.reduce((a, b) => a + b, 0) / montos.length;
    const variacionMaxima = Math.max(...montos.map(m => Math.abs(m - montoPromedio) / montoPromedio));

    // Si la variación es <= 5%, es gasto fijo (más estricto)
    if (variacionMaxima <= 0.05) {
      gastosFijos.add(nombre);
      analisis[nombre] = {
        tipo: 'fijo',
        meses: mesesUnicos.length,
        montoPromedio,
        variacion: (variacionMaxima * 100).toFixed(1) + '%'
      };
    } else {
      analisis[nombre] = {
        tipo: 'variable',
        razon: `variación ${(variacionMaxima * 100).toFixed(1)}% > 10%`,
        meses: mesesUnicos.length
      };
    }
  });

  return { gastosFijos, analisis };
};

// Función para determinar si un movimiento es gasto fijo
const esGastoFijo = (mov, gastosFijos) => {
  if (!gastosFijos || gastosFijos.size === 0) return false;
  const nombre = (mov.referencia_limpia || mov.referencia_original || '').toLowerCase().trim();
  return gastosFijos.has(nombre);
};

// Calcular totales de gastos fijos y variables
const calcularTotalesGastos = (movimientos, gastosFijos) => {
  let totalFijos = 0;
  let totalVariables = 0;
  let countFijos = 0;
  let countVariables = 0;

  movimientos.forEach(mov => {
    const monto = mov.monto_pesos || 0;
    if (monto <= 0) return; // Ignorar devoluciones

    if (esGastoFijo(mov, gastosFijos)) {
      totalFijos += monto;
      countFijos++;
    } else {
      totalVariables += monto;
      countVariables++;
    }
  });

  return { totalFijos, totalVariables, countFijos, countVariables };
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
const CreditCardVisual = ({ tarjeta, stats, onClick, nombrePersonalizado, onEditarNombre, cotizacion = null }) => {
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
                <div>
                  <p className="text-emerald-500 text-sm font-medium">
                    {formatMontoDolares(ultimoResumen.total_a_pagar_dolares)}
                  </p>
                  {cotizacion?.venta && (
                    <p className={`${textMuted} text-xs`}>
                      ≈ {formatMonto(ultimoResumen.total_a_pagar_dolares * cotizacion.venta)} ARS
                    </p>
                  )}
                </div>
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
const SettingsModal = ({ isOpen, onClose, tarjetas, reglas, movimientos, resumenes, cuotasActivas, onRefreshData, theme, setTheme, initialTab = 'tarjetas' }) => {
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('tarjetas');
  const [filtroTipoGastoInicial, setFiltroTipoGastoInicial] = useState('');

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
  const [reglas, setReglas] = useState([]);
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
      // Silently fail
    }
  };

  // Función para guardar edición de descripción de movimiento
  // Guarda como regla local y aplica a todos los movimientos con la misma referencia_original
  const guardarEdicionDescripcion = async (referenciaOriginal, nombreLimpio) => {

    // 1. Guardar como regla local en storage
    const regla = {
      patron: referenciaOriginal,
      nombre_limpio: nombreLimpio,
      es_exacta: true, // Marca que es coincidencia exacta, no regex
      fecha_creacion: new Date().toISOString()
    };
    storage.saveRegla(regla);

    // 2. Aplicar a todos los movimientos locales con la misma referencia_original
    const movimientosActualizados = movimientos.map(m => {
      if (m.referencia_original === referenciaOriginal) {
        return { ...m, referencia_limpia: nombreLimpio };
      }
      return m;
    });
    setMovimientos(movimientosActualizados);

    // 3. Actualizar también en localStorage
    storage.setItem('tarjetas_movimientos', movimientosActualizados);

    // 4. Sincronizar con backend para futuras importaciones
    try {
      await fetch(`${API_BASE}/reglas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patron: referenciaOriginal,
          nombre_limpio: nombreLimpio,
          referencia_original: referenciaOriginal
        })
      });
    } catch (e) {
      // Silently fail - backend sync is optional
    }
  };

  // Theme toggle
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Limpiar filtro de tipo de gasto cuando se cambia de vista (excepto cuando vamos a movimientos)
  useEffect(() => {
    if (activeView !== 'movimientos') {
      setFiltroTipoGastoInicial('');
    }
  }, [activeView]);
  
  // Fetch all data from localStorage
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
        movimientosData = movimientosData.map(m => {
          // Buscar si hay una regla que coincida con la referencia_original
          const regla = reglasLocales.find(r => {
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
      const estadisticas = storage.getEstadisticas();
      const evolucion = storage.getEvolucionMensual(6);

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
        monto_cuota_pesos: m.monto_pesos || 0,
        monto_cuota_dolares: m.monto_dolares || 0,
        monto_total: (m.monto_pesos || m.monto_dolares || 0) * m.total_cuotas,
        es_ultima_cuota: m.cuota_actual === m.total_cuotas,
        fecha_compra: m.fecha_compra
      }));

      setTarjetas(tarjetasEnriquecidas);
      setMovimientos(movimientosData);
      setResumenes(resumenesData);
      setCuotasActivas(cuotasFormateadas);

      // Analizar gastos fijos vs variables
      const { gastosFijos: fijosSet } = analizarGastosFijosVariables(movimientosData);
      setGastosFijos(fijosSet);
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
      setReglas(reglasLocales);

      // Calcular proyección de cuotas anclada al PERÍODO del resumen de cada tarjeta
      // (no a la fecha de hoy ni al orden de subida). Cada cuota se ubica en su mes
      // calendario real: si la cuota N cae en el período P, la cuota N+k cae en P+k.
      // El "próximo mes" (índice 0) es el mes siguiente al último resumen disponible.
      const periodoDeTarjeta = (tarjeta) => {
        const r = ultimoResumenPorTarjeta[tarjeta];
        return r ? new Date(r.anio, r.mes - 1, 1) : null;
      };
      // Ancla global: período del resumen más reciente entre todas las tarjetas
      let anclaProyeccion = null;
      Object.values(ultimoResumenPorTarjeta).forEach(r => {
        const d = new Date(r.anio, r.mes - 1, 1);
        if (!anclaProyeccion || d > anclaProyeccion) anclaProyeccion = d;
      });
      if (!anclaProyeccion) anclaProyeccion = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      // Orden determinístico: el orden de subida no debe influir en el detalle ni en
      // los totales (ruido de punto flotante).
      const cuotasOrdenadas = [...cuotasActivasData].sort((a, b) =>
        (a.tarjeta || '').localeCompare(b.tarjeta || '')
        || (a.referencia_limpia || '').localeCompare(b.referencia_limpia || '')
        || (a.total_cuotas - b.total_cuotas)
        || ((a.monto_pesos || 0) - (b.monto_pesos || 0))
      );

      const proyeccionCalculada = [];
      for (let i = 0; i < 6; i++) {
        // Mes objetivo = ancla + (i + 1): el primer bucket es el mes siguiente al último resumen
        const fecha = new Date(anclaProyeccion.getFullYear(), anclaProyeccion.getMonth() + i + 1, 1);
        let totalMes = 0;
        const detalles = [];

        cuotasOrdenadas.forEach(m => {
          const periodoCuota = periodoDeTarjeta(m.tarjeta);
          if (!periodoCuota) return;
          // Meses entre el período de la cuota y el mes objetivo
          const diff = (fecha.getFullYear() - periodoCuota.getFullYear()) * 12
            + (fecha.getMonth() - periodoCuota.getMonth());
          const numeroCuota = m.cuota_actual + diff;
          // Solo cuotas futuras respecto del período (diff >= 1) que aún no terminaron
          if (diff >= 1 && numeroCuota <= m.total_cuotas) {
            totalMes += m.monto_pesos || 0;
            detalles.push({
              id: m.id,
              descripcion: m.referencia_limpia || m.referencia_original || 'Sin descripción',
              tarjeta: m.tarjeta,
              cuota_numero: numeroCuota,
              total_cuotas: m.total_cuotas,
              monto_cuota: m.monto_pesos || 0
            });
          }
        });

        proyeccionCalculada.push({
          mes: fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
          mes_nombre: fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
          total: Math.round(totalMes * 100) / 100, // redondeo a 2 decimales (estable)
          cantidad_cuotas: detalles.length,
          detalles
        });
      }
      setProyeccionCuotas(proyeccionCalculada);
    } catch (error) {
      console.error('[App] Error loading data:', error);
    }
    setLoading(false);
  }, []);
  
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
              gastosFijos={gastosFijos}
              cotizacion={cotizacion}
              onFiltrarMovimientos={(tipo) => {
                setFiltroTipoGastoInicial(tipo);
                setActiveView('movimientos');
              }}
            />
          ) : activeView === 'movimientos' ? (
            <MovimientosView
              movimientos={movimientos}
              tarjetas={tarjetas}
              searchQuery={searchQuery}
              formatCurrency={formatCurrency}
              onEditarDescripcion={guardarEdicionDescripcion}
              gastosFijos={gastosFijos}
              filtroTipoGastoInicial={filtroTipoGastoInicial}
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
      />
    </div>
  );
};

// Dashboard View
const DashboardView = ({ dashboard, tarjetas, proyecciones, proyeccionCuotas = [], chartColors, formatCurrency, theme, resumenes = [], onDeleteResumen, setActiveView, searchQuery = '', movimientos = [], cuotasActivas = [], nombresTarjetas = {}, onGuardarNombre, gastosFijos = new Set(), cotizacion = null, onFiltrarMovimientos }) => {
  const [showResumenes, setShowResumenes] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [mesDetalleIdx, setMesDetalleIdx] = useState(null);
  const [resumenCombinado, setResumenCombinado] = useState(false);

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

      {/* Badge cotización dólar */}
      {cotizacion && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <DollarSign className="w-3.5 h-3.5" />
            Dólar tarjeta: {formatMonto(cotizacion.venta || 0)}
            <span className="text-emerald-500/60 ml-1">
              · {new Date(cotizacion.cachedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </span>
        </div>
      )}

      {/* Stats Row */}
      {(() => {
        // Calcular gastos fijos del último resumen de CADA tarjeta
        // Agrupar movimientos por tarjeta y obtener el último período de cada una
        const ultimosPeriodosPorTarjeta = {};
        movimientos.forEach(m => {
          const tarjeta = m.tarjeta;
          const periodo = `${m.anio_resumen}-${String(m.mes_resumen).padStart(2, '0')}`;
          if (!ultimosPeriodosPorTarjeta[tarjeta] || periodo > ultimosPeriodosPorTarjeta[tarjeta]) {
            ultimosPeriodosPorTarjeta[tarjeta] = periodo;
          }
        });

        // Filtrar movimientos que pertenecen al último período de su tarjeta
        const movsUltimosPeriodos = movimientos.filter(m => {
          const periodo = `${m.anio_resumen}-${String(m.mes_resumen).padStart(2, '0')}`;
          return periodo === ultimosPeriodosPorTarjeta[m.tarjeta];
        });

        const { totalFijos } = calcularTotalesGastos(movsUltimosPeriodos, gastosFijos);

        // Total últimos 2 resúmenes de cada tarjeta (ARS + USD)
        const totalUltimoResumenARS = tarjetas.reduce((sum, t) => {
          const ultimos2 = resumenes
            .filter(r => r.tarjeta === t.nombre)
            .sort((a, b) => b.anio - a.anio || b.mes - a.mes)
            .slice(0, 2);
          return sum + ultimos2.reduce((s, r) => s + (r.total_a_pagar_pesos || 0), 0);
        }, 0);
        const totalUltimoResumenUSD = tarjetas.reduce((sum, t) => {
          const ultimos2 = resumenes
            .filter(r => r.tarjeta === t.nombre)
            .sort((a, b) => b.anio - a.anio || b.mes - a.mes)
            .slice(0, 2);
          return sum + ultimos2.reduce((s, r) => s + (r.total_a_pagar_dolares || 0), 0);
        }, 0);

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Repeat}
              label="Gastos Fijos"
              value={formatCurrency(totalFijos)}
              delay={100}
              onClick={() => onFiltrarMovimientos?.('fijo')}
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
              label="Último mes en cuotas"
              value={formatCurrency(proyeccionCuotas[0]?.total || 0)}
              delay={300}
            />
            {/* Card: total último resumen todas las tarjetas */}
            <div
              className="stat-card opacity-0 animate-fade-in-up"
              style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] bg-opacity-20">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                {totalUltimoResumenUSD > 0 && cotizacion?.venta && (
                  <button
                    onClick={() => setResumenCombinado(v => !v)}
                    title={resumenCombinado ? 'Ver separado' : 'Ver total en ARS'}
                    className={`text-xs px-2 py-1 rounded-lg border transition-colors font-medium ${
                      resumenCombinado
                        ? 'bg-[var(--accent-1)] text-white border-[var(--accent-1)]'
                        : 'text-[var(--text-muted)] border-[var(--glass-border)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]'
                    }`}
                  >
                    {resumenCombinado ? '= ARS' : '+ USD→ARS'}
                  </button>
                )}
              </div>
              <p className="text-[var(--text-muted)] text-sm mb-2">Total últimos 2 resúmenes</p>
              {resumenCombinado && cotizacion?.venta ? (
                <>
                  <p className="text-xl font-bold text-[var(--text-primary)] leading-tight">
                    {formatCurrency(totalUltimoResumenARS + totalUltimoResumenUSD * cotizacion.venta)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {formatCurrency(totalUltimoResumenARS)} + {formatMontoDolares(totalUltimoResumenUSD)} × {formatMonto(cotizacion.venta)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-[var(--text-primary)] leading-tight">
                    {formatCurrency(totalUltimoResumenARS)}
                  </p>
                  {totalUltimoResumenUSD > 0 && (
                    <p className="text-sm font-semibold text-emerald-500 mt-0.5">
                      + {formatMontoDolares(totalUltimoResumenUSD)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Cards Grid */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Mis Tarjetas</h3>
        <button
          onClick={() => setShowResumenes(true)}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-1)] transition-colors flex items-center gap-1"
        >
          <FileText className="w-4 h-4" />
          {dashboard.total_resumenes || 0} resúmenes cargados
        </button>
      </div>
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
              cotizacion={cotizacion}
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
              <p className="text-xs text-[var(--accent-1)]">{proyeccionCuotas[0]?.cantidad_cuotas || 0} consumos en cuotas pendientes</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--glass-bg)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Próximo mes</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {formatCurrency(proyeccionCuotas[1]?.total || 0)}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{proyeccionCuotas[1]?.cantidad_cuotas || 0} consumos en cuotas pendientes</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--glass-bg)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">En 3 meses</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {formatCurrency(proyeccionCuotas[2]?.total || 0)}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{proyeccionCuotas[2]?.cantidad_cuotas || 0} consumos en cuotas pendientes</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--glass-bg)]">
              <p className="text-xs text-[var(--text-muted)] mb-1">Total 6 meses</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {formatCurrency(proyeccionCuotas.reduce((s, m) => s + (m.total || 0), 0))}
              </p>
              <p className="text-xs text-[var(--text-muted)]">comprometidos</p>
            </div>
          </div>

          {/* Gráfico de barras — click para ver detalle */}
          <p className="text-xs text-[var(--text-muted)] mb-3 text-center">Hacé click en una barra para ver el detalle</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={proyeccionCuotas.map((m, idx) => ({
                mes: m.mes_nombre?.split(' ')[0] || m.mes,
                total: m.total,
                cantidad: m.cantidad_cuotas,
                idx
              }))}
              barCategoryGap="20%"
              onClick={(data) => {
                if (data?.activeTooltipIndex !== undefined) {
                  setMesDetalleIdx(prev => prev === data.activeTooltipIndex ? null : data.activeTooltipIndex);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
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
                formatter={(v, name, props) => [
                  `${formatMonto(v || 0)} · ${props?.payload?.cantidad || 0} consumos`,
                  'Total cuotas'
                ]}
              />
              <Bar
                dataKey="total"
                name="Cuotas"
                radius={[4, 4, 0, 0]}
              >
                {proyeccionCuotas.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={mesDetalleIdx === idx ? 'var(--accent-1)' : 'url(#colorGradient)'}
                    opacity={mesDetalleIdx !== null && mesDetalleIdx !== idx ? 0.4 : 1}
                  />
                ))}
              </Bar>
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-1)" />
                  <stop offset="100%" stopColor="var(--accent-2)" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>

          {/* Panel de detalle por mes */}
          {mesDetalleIdx !== null && (() => {
            const i = mesDetalleIdx;
            const mesInfo = proyeccionCuotas[i];
            const cuotasDelMes = mesInfo?.detalles || [];
            return (
              <div className="mt-4 border-t border-[var(--glass-border)] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {mesInfo?.mes_nombre || `Mes ${i + 1}`} — {cuotasDelMes.length} consumos en cuotas pendientes
                  </p>
                  <button
                    onClick={() => setMesDetalleIdx(null)}
                    className="p-1 rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-muted)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {cuotasDelMes.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-4">Sin cuotas comprometidas este mes</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {cuotasDelMes.map((c) => {
                      const cuotaNumero = c.cuota_numero;
                      const color = getTarjetaColor(c.tarjeta);
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--glass-bg)]">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: color }}
                            >
                              {c.tarjeta}
                            </span>
                            <p className="text-sm text-[var(--text-primary)] truncate">{c.descripcion}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className="text-xs text-[var(--text-muted)]">
                              cuota {cuotaNumero}/{c.total_cuotas}
                            </span>
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                              {formatMonto(c.monto_cuota || 0)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

// Movimientos View con paginación por mes y filtros
const MovimientosView = ({ movimientos, tarjetas = [], searchQuery, formatCurrency, onEditarDescripcion, gastosFijos = new Set(), filtroTipoGastoInicial = '' }) => {
  const [mesActual, setMesActual] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Estado para edición inline
  const [editandoId, setEditandoId] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');

  // Estados de filtros
  const [filtroTarjeta, setFiltroTarjeta] = useState('');
  const [filtroBanco, setFiltroBanco] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroMoneda, setFiltroMoneda] = useState('');
  const [filtroCuotas, setFiltroCuotas] = useState('');
  const [filtroTipoGasto, setFiltroTipoGasto] = useState(filtroTipoGastoInicial); // '', 'fijo', 'variable'

  // Actualizar filtro si cambia el prop inicial y mostrar filtros si hay uno activo
  useEffect(() => {
    if (filtroTipoGastoInicial) {
      setFiltroTipoGasto(filtroTipoGastoInicial);
      setShowFilters(true);
    }
  }, [filtroTipoGastoInicial]);

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
    setFiltroTipoGasto('');
  };

  // Contar filtros activos
  const filtrosActivos = [filtroTarjeta, filtroBanco, filtroFechaDesde, filtroFechaHasta, filtroMoneda, filtroCuotas, filtroTipoGasto]
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

    // Filtro por tipo de gasto (fijo/variable)
    if (filtroTipoGasto === 'fijo' && !esGastoFijo(m, gastosFijos)) return false;
    if (filtroTipoGasto === 'variable' && esGastoFijo(m, gastosFijos)) return false;

    return true;
  });

  // Detectar si es última cuota
  const esUltimaCuota = (cuotaTexto) => {
    if (!cuotaTexto) return false;
    const match = cuotaTexto.match(/(\d+)\/(\d+)/);
    return match && match[1] === match[2];
  };

  // Guardar edición de descripción
  const handleGuardarEdicion = (mov) => {
    if (nuevoNombre.trim() && nuevoNombre.trim() !== (mov.referencia_limpia || mov.referencia_original)) {
      onEditarDescripcion?.(mov.referencia_original, nuevoNombre.trim());
    }
    setEditandoId(null);
    setNuevoNombre('');
  };

  // Iniciar edición
  const handleIniciarEdicion = (mov) => {
    setEditandoId(mov.id);
    setNuevoNombre(mov.referencia_limpia || mov.referencia_original);
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-3 border-t border-[var(--glass-border)]">
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

            {/* Filtro por Tipo de Gasto */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Tipo</label>
              <select
                value={filtroTipoGasto}
                onChange={(e) => setFiltroTipoGasto(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]
                           text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-1)]"
              >
                <option value="">Todos</option>
                <option value="fijo">Fijos</option>
                <option value="variable">Variables</option>
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
                <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Tipo</th>
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
                    {editandoId === mov.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={nuevoNombre}
                          onChange={(e) => setNuevoNombre(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleGuardarEdicion(mov);
                            if (e.key === 'Escape') { setEditandoId(null); setNuevoNombre(''); }
                          }}
                          autoFocus
                          className="flex-1 px-2 py-1 rounded-lg bg-[var(--glass-bg)] border border-[var(--accent-1)]
                                     text-[var(--text-primary)] text-sm focus:outline-none"
                        />
                        <button
                          onClick={() => handleGuardarEdicion(mov)}
                          className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                          title="Guardar"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditandoId(null); setNuevoNombre(''); }}
                          className="p-1.5 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30"
                          title="Cancelar"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <span>{mov.referencia_limpia || mov.referencia_original}</span>
                        <button
                          onClick={() => handleIniciarEdicion(mov)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[var(--glass-bg)]
                                     text-[var(--text-muted)] hover:text-[var(--accent-1)] transition-all"
                          title="Editar descripcion"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    {esGastoFijo(mov, gastosFijos) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                      bg-blue-500/15 text-blue-500 text-xs font-medium border border-blue-500/30"
                            title="Gasto fijo - aparece todos los meses con monto similar">
                        <Repeat className="w-3 h-3" />
                        Fijo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                      bg-amber-500/15 text-amber-500 text-xs font-medium border border-amber-500/30"
                            title="Gasto variable">
                        <Shuffle className="w-3 h-3" />
                        Variable
                      </span>
                    )}
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

      // Guardar cada resultado exitoso en localStorage
      const resultados = data.data?.resultados || data.resultados || [];
      for (const resultado of resultados) {
        if (resultado.exito && resultado.datos) {
          const { resumen, movimientos, tarjeta } = resultado.datos;

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
              if (n.includes('AMEX') || n.includes('AMERICAN EXPRESS')) tipo = 'AMEX';
              else if (n.includes('MASTERCARD')) tipo = 'MASTERCARD';
              else if (n.includes('VISA')) tipo = 'VISA';
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
            storage.saveResumen(resumenData);

            // Guardar movimientos
            if (movimientos && movimientos.length > 0) {
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
