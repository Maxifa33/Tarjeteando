import React from 'react';
import { Puzzle } from 'lucide-react';
import { moduloPorId } from '../registro.js';
import Proximamente from './Proximamente.jsx';
import './modulos.css';

/** Un módulo que falla no tumba Tarjeteando. */
class Aislado extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('[modulos]', this.props.id, error); }
  componentDidUpdate(prev) { if (prev.id !== this.props.id && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) {
      return (
        <div className="mod-aviso" role="alert">
          <span>Este módulo tuvo un problema. El resto de la app sigue funcionando.</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const Vacio = ({ onIrAModulos }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, maxWidth: 520 }}>
    <span className="mod-tesela" aria-hidden="true"><Puzzle size={22} /></span>
    <p style={{ margin: 0, fontSize: 17, lineHeight: '24px', color: 'var(--label2)' }}>Este módulo no está activo.</p>
    <button type="button" className="btn btn-pri" onClick={onIrAModulos} style={{ minHeight: 44, borderRadius: 22, padding: '0 18px' }}>Ir a Módulos</button>
  </div>
);

const ModuloHost = ({ moduloId, modulos, puente, onIrAModulos }) => {
  const modulo = moduloPorId(moduloId);
  if (!modulo || !modulos.estado[moduloId]?.activo) return <Vacio onIrAModulos={onIrAModulos} />;
  return (
    <Aislado id={moduloId}>
      <Proximamente modulo={modulo} puente={modulo.usaPuenteTarjeteando ? puente : null} />
    </Aislado>
  );
};

export default ModuloHost;
