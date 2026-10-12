import React, { useMemo, useState } from 'react';
import { Upload, Tags, FolderOpen } from 'lucide-react';
import GestionCategorias from './GestionCategorias.jsx';
import ArchivosImportados from './ArchivosImportados.jsx';
import { pesos } from '../../../ui/formato.js';
import { resumenPlatita } from '../../cuentas/resumen.js';
import { comprasDeTarjeta } from '../../puente/tarjeteando.js';
import { useMovimientosMes, SelectorMes, Cifra, PorCategoria, ListaMovs, AvisoRevisar, EditarMov } from './comunes.jsx';
import ImportarCuentas from './ImportarCuentas.jsx';

/** Platita: ingresos del mes, activos (trabajo) y pasivos (rinden solos). */
const PlatitaView = ({ tarjeteando }) => {
  const compras = useMemo(() => comprasDeTarjeta(tarjeteando?.movimientos || []), [tarjeteando]);
  const { mes, setMes, movs, cats, cargando, error, recargar, recargarCats } = useMovimientosMes();
  const [verCategorias, setVerCategorias] = useState(false);
  const [verArchivos, setVerArchivos] = useState(false);
  const [importando, setImportando] = useState(false);
  const [editando, setEditando] = useState(null);
  const r = useMemo(() => resumenPlatita(movs), [movs]);

  if (!mes) return <p role="status" style={{ margin: 0 }}>Cargando…</p>;
  const sinNada = !cargando && !r.lista.length && !r.revisar.length;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <SelectorMes mes={mes} onCambio={setMes} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => setVerCategorias(true)} style={{ minHeight: 44 }}>
            <Tags size={16} aria-hidden="true" /> Categorías
          </button>
          <button type="button" className="btn" onClick={() => setVerArchivos(true)} style={{ minHeight: 44 }}>
            <FolderOpen size={16} aria-hidden="true" /> Archivos
          </button>
          <button type="button" className="btn" onClick={() => setImportando(true)} style={{ minHeight: 44 }}>
            <Upload size={16} aria-hidden="true" /> Importar movimientos
          </button>
        </div>
      </div>

      {error && <div className="mod-aviso" role="alert">{error}</div>}

      {sinNada ? (
        <div style={{ padding: 20, borderRadius: 20, background: 'var(--fill2)', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <p style={{ margin: 0, fontSize: 17 }}>No hay ingresos en este mes.</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Importá el movimiento de tu cuenta de Galicia o el resumen de Mercado Pago y se cargan solos.</p>
          <button type="button" className="btn btn-pri" onClick={() => setImportando(true)} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>Importar movimientos</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }} aria-busy={cargando}>
            <Cifra label="Ingresos del mes" valor={pesos(r.total)} fuerte />
            <Cifra label="Activos" valor={pesos(r.activos)} nota="Sueldo, honorarios, extras" />
            <Cifra label="Pasivos" valor={pesos(r.pasivos)} nota="Rendimientos e intereses" />
          </div>
          <AvisoRevisar cantidad={r.revisar.length}
            texto={`${r.revisar.length} ${r.revisar.length === 1 ? 'entrada' : 'entradas'} sin confirmar (${pesos(r.revisar.reduce((s, m) => s + m.monto, 0))}): pueden ser ingresos, plata tuya o un Recupero (te devolvieron un gasto). No suman hasta que los confirmes.`} />
          {r.revisar.length > 0 && <ListaMovs titulo="A revisar" movs={r.revisar} onAbrir={setEditando} vacio="" />}
          <PorCategoria titulo="Por categoría" filas={r.porCategoria} total={r.total} />
          <ListaMovs titulo="Ingresos" movs={r.lista} onAbrir={setEditando} vacio="Sin ingresos confirmados." />
        </>
      )}

      <GestionCategorias abierta={verCategorias} tipo="ingreso" todas={cats} onCerrar={() => setVerCategorias(false)} onCambio={async () => { await recargarCats(); await recargar(); }} />
      <ArchivosImportados abierta={verArchivos} onCerrar={() => setVerArchivos(false)} onCambio={async () => { await recargarCats(); await recargar(); }} />
      <ImportarCuentas abierta={importando} onCerrar={() => setImportando(false)} onImportado={recargar} />
      <EditarMov mov={editando} cats={cats} compras={compras} onCerrar={() => setEditando(null)} onGuardado={recargar} />
    </section>
  );
};

export default PlatitaView;
