'use client';
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

function ColorPicker({ value, onChange }) {
  const colors = ['#1b9af5','#f59e0b','#1b9af5','#8b5cf6','#10b981','#ef4444','#ec4899','#14b8a6','#f97316','#84cc16'];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {colors.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full transition-all ${value === c ? 'ring-2 ring-white ring-offset-1 ring-offset-surface scale-110' : ''}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevoPipeline, setNuevoPipeline] = useState('');
  const [creando, setCreando] = useState(false);
  const [nuevaEtapa, setNuevaEtapa] = useState({});
  const [editandoEtapa, setEditandoEtapa] = useState(null);

  const cargar = () => {
    setLoading(true);
    api.pipelines().then(setPipelines).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const crearPipeline = async () => {
    if (!nuevoPipeline.trim()) return;
    setCreando(true);
    try {
      await api.createPipeline(nuevoPipeline.trim());
      setNuevoPipeline('');
      cargar();
    } catch (e) { alert(e.message); }
    setCreando(false);
  };

  const crearEtapa = async (pipelineId) => {
    const data = nuevaEtapa[pipelineId];
    if (!data?.name?.trim()) return;
    try {
      await api.createStage(pipelineId, { name: data.name.trim(), color: data.color || '#1b9af5' });
      setNuevaEtapa(prev => ({ ...prev, [pipelineId]: { name: '', color: '#1b9af5' } }));
      cargar();
    } catch (e) { alert(e.message); }
  };

  const guardarEtapa = async (pipelineId, stageId) => {
    const data = editandoEtapa;
    if (!data?.name?.trim()) return;
    try {
      await api.updateStage(pipelineId, stageId, { name: data.name, color: data.color });
      setEditandoEtapa(null);
      cargar();
    } catch (e) { alert(e.message); }
  };

  const eliminarEtapa = async (pipelineId, stageId) => {
    if (!confirm('¿Eliminar esta etapa? Los leads en esta etapa perderán su etapa asignada.')) return;
    try {
      await api.deleteStage(pipelineId, stageId);
      cargar();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-white mb-2">Pipelines</h1>
      <p className="text-sm text-muted mb-8">Gestiona tus pipelines y etapas de venta</p>

      {/* Crear pipeline */}
      <div className="card p-4 mb-6">
        <div className="text-sm font-medium text-white mb-3">Nuevo pipeline</div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Nombre del pipeline"
            value={nuevoPipeline}
            onChange={e => setNuevoPipeline(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && crearPipeline()}
          />
          <button onClick={crearPipeline} disabled={creando || !nuevoPipeline.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            Crear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted text-sm gap-2">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Cargando...
        </div>
      ) : (
        <div className="space-y-6">
          {pipelines.map(pip => (
            <div key={pip.id} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-base font-semibold text-white">{pip.name}</h2>
                <span className="text-xs text-muted bg-white/5 px-2 py-0.5 rounded-full">{pip.stages?.length || 0} etapas</span>
              </div>

              {/* Etapas */}
              <div className="space-y-2 mb-4">
                {pip.stages?.map(stage => (
                  <div key={stage.id} className="flex items-center gap-3 px-3 py-2 bg-bg rounded-lg border border-border">
                    {editandoEtapa?.id === stage.id ? (
                      <>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: editandoEtapa.color }} />
                        <input
                          className="input flex-1 h-7 text-xs py-1"
                          value={editandoEtapa.name}
                          onChange={e => setEditandoEtapa(p => ({ ...p, name: e.target.value }))}
                        />
                        <ColorPicker value={editandoEtapa.color} onChange={c => setEditandoEtapa(p => ({ ...p, color: c }))} />
                        <button onClick={() => guardarEtapa(pip.id, stage.id)} className="text-xs text-success hover:text-success/80 px-2">Guardar</button>
                        <button onClick={() => setEditandoEtapa(null)} className="text-xs text-muted hover:text-white px-2">Cancelar</button>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                        <span className="text-sm text-white flex-1">{stage.name}</span>
                        <button
                          onClick={() => setEditandoEtapa({ id: stage.id, name: stage.name, color: stage.color })}
                          className="text-xs text-muted hover:text-white transition-colors px-2"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarEtapa(pip.id, stage.id)}
                          className="text-xs text-muted hover:text-danger transition-colors px-2"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {pip.stages?.length === 0 && (
                  <p className="text-xs text-muted text-center py-3">Sin etapas — agrega una abajo</p>
                )}
              </div>

              {/* Agregar etapa */}
              <div className="border-t border-border pt-4">
                <div className="text-xs text-muted mb-2">Agregar etapa</div>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    className="input flex-1 min-w-32"
                    placeholder="Nombre de la etapa"
                    value={nuevaEtapa[pip.id]?.name || ''}
                    onChange={e => setNuevaEtapa(prev => ({ ...prev, [pip.id]: { ...prev[pip.id], name: e.target.value } }))}
                    onKeyDown={e => e.key === 'Enter' && crearEtapa(pip.id)}
                  />
                  <ColorPicker
                    value={nuevaEtapa[pip.id]?.color || '#1b9af5'}
                    onChange={c => setNuevaEtapa(prev => ({ ...prev, [pip.id]: { ...prev[pip.id], color: c } }))}
                  />
                  <button
                    onClick={() => crearEtapa(pip.id)}
                    disabled={!nuevaEtapa[pip.id]?.name?.trim()}
                    className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
