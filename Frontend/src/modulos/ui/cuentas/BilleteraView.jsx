import React, { useEffect, useMemo, useState } from 'react';
import { Upload, Tags, FolderOpen } from 'lucide-react';
import GestionCategorias from './GestionCategorias.jsx';
import ArchivosImportados from './ArchivosImportados.jsx';
import { pesos } from '../../../ui/formato.js';
import Seg from '../../../ui/Seg.jsx';
import { resumenBilletera } from '../../cuentas/resumen.js';
import { listarBolsillos, cambiarTipoBolsillo } from '../../cuentas/repo.js';
import { comprasDeTarjeta } from '../../puente/tarjeteando.js';
import { useMovimientosMes, SelectorMes, Cifra, PorCategoria, ListaMovs, AvisoRevisar, EditarMov } from './comunes.jsx';
import ImportarCuentas from './ImportarCuentas.jsx';

/** Reservas de Mercado Pago: el usuario decide si cada una es Apartado o Ahorro. */
const Reservas = ({ onCambio }) => {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => { listarBolsillos().then(setLista).catch(() => {}); }, []);
  if (!lista.length) return null;
  const cambiar = async (b, tipo) => {
    setLista((l) => l.map((x) => (x.id === b.id ? { ...x, tipo } : x)));
    try { await cambiarTipoBolsillo(b.id, tipo); onCambio?.(); }
    catch { setLista((l) => l.map((x) => (x.id === b.id ? b : x))); setError('No se pudo guardar.'); }
  };
  return (
    <section aria-labelledby="bil-reservas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 id="bil-reservas" className="h3" style={{ margin: 0 }}>Tus reservas</h2>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Apartado: plata separada para un gasto que viene. Ahorro: fondo que no pensás gastar.</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((b) => (
          <li key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15 }}>{b.nombre}</span>
            <Seg opciones={[{ id: 'apartado', label: 'Apartado' }, { id: 'ahorro', label: 'Ahorro' }]} valor={b.tipo} onCambio={(t) => cambiar(b, t)} ariaLabel={`Tipo de la reserva ${b.nombre}`} />
          </li>
        ))}
      </ul>
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
    </section>
  );
};

/** Billetera: lo que gastaste sin tarjeta (efectivo y transferencias). */
const BilleteraView = ({ tarjeteando }) => {
  const compras = useMemo(() => comprasDeTarjeta(tarjeteando?.movimientos || []), [tarjeteando]);
  const { mes, setMes, movs, cats, cargando, error, recargar, recargarCats } = useMovimientosMes();
  const [verCategorias, setVerCategorias] = useState(false);
  const [verArchivos, setVerArchivos] = useState(false);
  const [importando, setImportando] = useState(false);
  const [editando, setEditando] = useState(null);
  const r = useMemo(() => resumenBilletera(movs), [movs]);

  if (!mes) return <p role="status" style={{ margin: 0 }}>Cargando…</p>;
  const sinNada = !cargando && !movs.length;

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
          <p style={{ margin: 0, fontSize: 17 }}>No hay movimientos en este mes.</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--label2)' }}>Importá tu cuenta de Galicia o el resumen de Mercado Pago. Los pagos de tarjeta y la plata entre tus cuentas no se cuentan como gasto.</p>
          <button type="button" className="btn btn-pri" onClick={() => setImportando(true)} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>Importar movimientos</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }} aria-busy={cargando}>
            <Cifra label="Gastos sin tarjeta" valor={pesos(r.total)} fuerte />
            <Cifra label="Apartado en reservas" valor={pesos(r.apartado)} nota="Separado para gastos que vienen" />
            <Cifra label="Ahorrado" valor={pesos(r.ahorrado)} nota="Fondos como Emergencia" />
            {r.recuperado > 0 && <Cifra label="Recuperado" valor={pesos(r.recuperado)} nota={[r.recuperadoTarjeta ? `${pesos(r.recuperadoTarjeta)} de compras con tarjeta` : null, r.recuperadoNoSe ? `${pesos(r.recuperadoNoSe)} sin saber cómo se pagó` : null].filter(Boolean).join(' · ') || 'Plata que te devolvieron'} />}
          </div>
          {r.recuperado - r.recuperadoTarjeta - r.recuperadoNoSe > 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Gastaste {pesos(r.bruto)} y te devolvieron {pesos(r.recuperado - r.recuperadoTarjeta - r.recuperadoNoSe)}: tu gasto real sin tarjeta es {pesos(r.total)}.</p>
          )}
          {r.pagosTarjeta > 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Pagaste {pesos(r.pagosTarjeta)} de tarjetas desde tus cuentas: eso ya está en Tarjeteando y no se suma acá.</p>
          )}
          <AvisoRevisar cantidad={r.revisar.length}
            texto={`${r.revisar.length} ${r.revisar.length === 1 ? 'salida' : 'salidas'} sin confirmar (${pesos(r.revisar.reduce((s, m) => s + m.monto, 0))}), en su mayoría transferencias a personas. No suman hasta que las confirmes.`} />
          {r.revisar.length > 0 && <ListaMovs titulo="A revisar" movs={r.revisar} onAbrir={setEditando} vacio="" />}
          <PorCategoria titulo="Por categoría" filas={r.porCategoria} total={r.total} onAbrir={setEditando} />
          <ListaMovs titulo="Gastos" movs={r.lista} onAbrir={setEditando} vacio="Sin gastos confirmados." />
          {r.recuperos.length > 0 && <ListaMovs titulo="Recuperos" movs={r.recuperos} onAbrir={setEditando} vacio="" />}
          <Reservas onCambio={recargar} />
        </>
      )}

      <GestionCategorias abierta={verCategorias} tipo="gasto" todas={cats} onCerrar={() => setVerCategorias(false)} onCambio={async () => { await recargarCats(); await recargar(); }} />
      <ArchivosImportados abierta={verArchivos} onCerrar={() => setVerArchivos(false)} onCambio={async () => { await recargarCats(); await recargar(); }} />
      <ImportarCuentas abierta={importando} onCerrar={() => setImportando(false)} onImportado={recargar} />
      <EditarMov mov={editando} cats={cats} compras={compras} onCerrar={() => setEditando(null)} onGuardado={recargar} onCategoriaCreada={recargarCats} />
    </section>
  );
};

export default BilleteraView;
